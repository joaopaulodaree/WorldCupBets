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

/** Build a chainable mock admin that:
 * - Returns empty array for the "check existing picks" select
 * - Returns a kickoff in the future for the "lock check"
 * - Returns count=16 for the "R32 populated" check
 * - Returns { error: null } for insert
 */
function buildMockAdmin() {
  // Chainable builder for .select().eq()...limit() or .not()...order()...limit() etc.
  // We use a single chain object that always resolves the terminal promise.
  const makeChain = (terminalValue: unknown) => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'neq', 'not', 'order', 'limit', 'insert'];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    // Override limit and insert to return the terminal promise
    (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(terminalValue);
    (chain.insert as ReturnType<typeof vi.fn>).mockResolvedValue(terminalValue);
    return chain;
  };

  // Build separate chains per `from()` call
  // Call order: bracket_picks (check existing), knockout_matches (lock), knockout_matches (count), bracket_picks (insert)
  const existingPicksChain = makeChain({ data: [] });
  const lockChain = makeChain({
    data: [{ kickoff_at: new Date(Date.now() + 86400000).toISOString() }],
  });
  const countChain = makeChain({ count: 16 });
  const insertChain = makeChain({ error: null });
  // insert on the 4th from() call
  (insertChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

  let fromCallCount = 0;
  const from = vi.fn(() => {
    fromCallCount++;
    if (fromCallCount === 1) return existingPicksChain; // bracket_picks select
    if (fromCallCount === 2) return lockChain;           // knockout_matches lock
    if (fromCallCount === 3) return countChain;          // knockout_matches count
    return insertChain;                                   // bracket_picks insert
  });

  return { from };
}

function makeValidPicks() {
  const picks: Array<{ round: number; slot: number; teamId: string }> = [];
  const rounds: [number, number][] = [[5, 16], [6, 8], [7, 4], [8, 2], [9, 1]];
  for (const [round, count] of rounds) {
    for (let slot = 0; slot < count; slot++) {
      picks.push({ round, slot, teamId: `team-${round}-${slot}` });
    }
  }
  return picks;
}

describe('POST /api/bracket/submit', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdmin = buildMockAdmin();
  });

  test('returns 400 when picks.length !== 31', async () => {
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
    expect(body.error).toContain('31');
  });

  test('returns 400 when a round has wrong slot count', async () => {
    const { POST } = await import('./route');

    // Build picks with round 5 having only 15 picks and round 6 having 9 (to keep total at 31)
    const picks = makeValidPicks();
    // Remove one R5 pick and add one to R6 to shift counts but keep total=31
    const badPicks = picks.filter(p => !(p.round === 5 && p.slot === 15));
    badPicks.push({ round: 6, slot: 8, teamId: 'extra-r6' });
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
        ? { round: 5, slot: 1, teamId: 'duplicate' }
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
