import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: 'mock-token' })),
  })),
}));

vi.mock('@/lib/auth', () => ({
  COOKIE_NAME: 'wcb_session',
  verifyToken: vi.fn().mockResolvedValue({ id: 'user-123', name: 'Test', email: 'test@test.com' }),
}));

// We define mockAdmin as a variable that the factory closure captures.
// We reassign it per-test in beforeEach.
let mockAdmin: ReturnType<typeof buildMockAdmin>;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdmin,
}));

/**
 * Build a chainable mock admin.
 * The route makes these DB calls in order:
 *  1. bracket_picks.select('id').eq().eq().limit(1)          → existing picks check
 *  2. knockout_matches.select('round,slot').not().not()       → available matches (no .limit())
 *  3. knockout_matches.select('kickoff_at').eq().not().order().limit(1) → lock check
 *  4. bracket_picks.insert(rows)                              → insert picks
 *
 * We mock `from(table)` returning table-specific chains so that:
 *  - bracket_picks chains resolve limit() → { data: [] } and insert() → { error: null }
 *  - first knockout_matches chain (available matches) awaits directly → { data: [...] }
 *  - second knockout_matches chain (lock check) resolves limit() → { data: [future kickoff] }
 */
function buildMockAdmin(availableMatchData?: Array<{ round: number; slot: number }>) {
  // Default: all 31 slots populated
  const defaultMatches = makeAllMatches();
  const matchData = availableMatchData ?? defaultMatches;

  // A thenable chain that also supports method chaining.
  // When the route does `const { data } = await chain.not().not()`, the chain must be a
  // thenable that resolves to { data: matchData }.
  const makeAwaitableChain = (resolveValue: unknown) => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'neq', 'not', 'order', 'limit'];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    // Make the chain itself a thenable (so `await chain` works)
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);
    // Also make limit() resolve to the same value (for chains that do use .limit())
    (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(resolveValue);
    return chain;
  };

  let bracketPicksCallCount = 0;
  let knockoutMatchesCallCount = 0;

  const from = vi.fn((table: string) => {
    if (table === 'bracket_picks') {
      bracketPicksCallCount++;
      if (bracketPicksCallCount === 1) {
        // existing picks check — returns empty array
        return makeAwaitableChain({ data: [] });
      }
      // insert call
      const insertChain = makeAwaitableChain({ error: null });
      insertChain.insert = vi.fn().mockResolvedValue({ error: null });
      return insertChain;
    }
    if (table === 'knockout_matches') {
      knockoutMatchesCallCount++;
      if (knockoutMatchesCallCount === 1) {
        // available matches query — awaited directly (no .limit())
        return makeAwaitableChain({ data: matchData });
      }
      // lock check — uses .limit(1)
      return makeAwaitableChain({
        data: [{ kickoff_at: new Date(Date.now() + 86400000).toISOString() }],
      });
    }
    return makeAwaitableChain({ data: null, error: null });
  });

  return { from };
}

function makeAllMatches() {
  const matches: Array<{ round: number; slot: number }> = [];
  const rounds: [number, number][] = [[5, 16], [6, 8], [7, 4], [8, 2], [9, 1]];
  for (const [round, count] of rounds) {
    for (let slot = 0; slot < count; slot++) {
      matches.push({ round, slot });
    }
  }
  return matches;
}

function makeValidPicks() {
  const picks: Array<{ round: number; slot: number; teamId: string; homeGoals: number; awayGoals: number }> = [];
  const rounds: [number, number][] = [[5, 16], [6, 8], [7, 4], [8, 2], [9, 1]];
  for (const [round, count] of rounds) {
    for (let slot = 0; slot < count; slot++) {
      picks.push({ round, slot, teamId: `team-${round}-${slot}`, homeGoals: 2, awayGoals: 1 });
    }
  }
  return picks;
}

describe('POST /api/bracket/submit', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdmin = buildMockAdmin();
  });

  test('returns 400 when a pick is a draw (homeGoals === awayGoals)', async () => {
    const { POST } = await import('./route');

    const picks = makeValidPicks();
    // Make one pick a draw
    picks[0] = { ...picks[0], homeGoals: 1, awayGoals: 1 };

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empate/i);
  });

  test('returns 400 when picks.length does not match available matches', async () => {
    const { POST } = await import('./route');

    const shortPicks = makeValidPicks().slice(0, 10); // only 10 picks
    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks: shortPicks }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    // Should say "Envie exatamente 31 picks"
    expect(body.error).toContain('31');
  });

  test('returns 400 when a round has wrong slot count', async () => {
    const { POST } = await import('./route');

    // Build picks with round 5 having only 15 picks and round 6 having 9 (to keep total at 31)
    const picks = makeValidPicks();
    // Remove one R5 pick and add one to R6 to shift counts but keep total=31
    const badPicks = picks.filter(p => !(p.round === 5 && p.slot === 15));
    badPicks.push({ round: 6, slot: 8, teamId: 'extra-r6', homeGoals: 2, awayGoals: 1 });
    // Now R5 has 15 (wrong), R6 has 9 (wrong), total=31

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks: badPicks }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    // Should mention the wrong round
    expect(body.error).toMatch(/Rodada/);
  });

  test('returns 400 when a slot is missing in a round (duplicate slot replacing missing one)', async () => {
    const { POST } = await import('./route');

    const picks = makeValidPicks();
    // Replace slot 0 of round 5 with a duplicate of slot 1
    const badPicks = picks.map(p =>
      p.round === 5 && p.slot === 0
        ? { round: 5, slot: 1, teamId: 'duplicate', homeGoals: 2, awayGoals: 1 }
        : p
    );
    // Total is still 31, R5 still has 16 picks, but slot 0 is missing

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks: badPicks }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('slot 0');
  });
});
