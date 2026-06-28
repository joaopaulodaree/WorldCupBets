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

let mockAdmin: ReturnType<typeof buildMockAdmin>;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdmin,
}));

/**
 * Build a thenable chain that always resolves to terminalValue when awaited,
 * while still supporting method chaining (each method returns the chain).
 */
function makeThenable(terminalValue: unknown) {
  const methods = ['select', 'eq', 'neq', 'not', 'order', 'limit', 'upsert', 'insert'];
  const chain: Record<string, unknown> = {};
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(terminalValue).then(resolve, reject);
  return chain;
}

// Returns 16 R32 matches with future kickoffs and both teams populated
function makeRoundMatches(overrides: Partial<{
  kickoff_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}> = {}) {
  return Array.from({ length: 16 }, (_, slot) => ({
    slot,
    kickoff_at: overrides.kickoff_at !== undefined
      ? overrides.kickoff_at
      : new Date(Date.now() + 86400000).toISOString(), // tomorrow
    home_team_id: overrides.home_team_id !== undefined ? overrides.home_team_id : `home-team-${slot}`,
    away_team_id: overrides.away_team_id !== undefined ? overrides.away_team_id : `away-team-${slot}`,
  }));
}

function buildMockAdmin(matchData = makeRoundMatches()) {
  const matchInfoChain = makeThenable({ data: matchData });
  const upsertChain = makeThenable({ error: null });
  (upsertChain.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

  const from = vi.fn((tableName: string) => {
    if (tableName === 'knockout_matches') return matchInfoChain;
    return upsertChain; // bracket_picks
  });

  return { from };
}

function makeR32Picks() {
  return Array.from({ length: 16 }, (_, slot) => ({
    slot,
    teamId: `home-team-${slot}`,
  }));
}

describe('POST /api/bracket/submit', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdmin = buildMockAdmin();
  });

  test('returns 400 when round is missing', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks: makeR32Picks() }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Rodada inválida');
  });

  test('returns 400 when round is invalid', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 99, picks: makeR32Picks() }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Rodada inválida');
  });

  test('returns 400 when picks array is empty', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 5, picks: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Nenhum pick enviado');
  });

  test('returns 409 when all picks are for already-started matches', async () => {
    mockAdmin = buildMockAdmin(
      makeRoundMatches({ kickoff_at: new Date(Date.now() - 3600000).toISOString() })
    );
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 5, picks: makeR32Picks() }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('Nenhum pick válido');
  });

  test('returns 200 with partial picks for a round', async () => {
    const { POST } = await import('./route');

    const partialPicks = makeR32Picks().slice(0, 5);
    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 5, picks: partialPicks }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('returns 200 with all valid R32 picks when round is open', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 5, picks: makeR32Picks() }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
