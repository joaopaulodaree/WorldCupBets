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
  // Make the chain itself a thenable so `await chain.method()` resolves correctly
  chain.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(terminalValue).then(resolve, reject);
  return chain;
}

/**
 * Build a mock admin whose from() returns appropriate chains:
 * - knockout_matches (1st call): lock check → future kickoff via limit
 * - knockout_matches (2nd call): count check → {count: 16} via thenable
 * - bracket_picks: upsert → {error: null}
 */
function buildMockAdmin() {
  const lockChain = makeThenable({
    data: [{ kickoff_at: new Date(Date.now() + 86400000).toISOString() }],
  });
  const countChain = makeThenable({ count: 16 });
  const upsertChain = makeThenable({ error: null });
  // upsert is the terminal call for the picks insert, override to resolve directly
  (upsertChain.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

  let knockoutCallCount = 0;
  const from = vi.fn((tableName: string) => {
    if (tableName === 'knockout_matches') {
      knockoutCallCount++;
      return knockoutCallCount === 1 ? lockChain : countChain;
    }
    return upsertChain; // bracket_picks
  });

  return { from };
}

function makeR32Picks() {
  return Array.from({ length: 16 }, (_, slot) => ({
    slot,
    teamId: `team-5-${slot}`,
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

  test('returns 400 when picks count is wrong for the round', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 5, picks: makeR32Picks().slice(0, 10) }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('16');
  });

  test('returns 400 when a slot is missing (duplicate slot replacing missing one)', async () => {
    const { POST } = await import('./route');

    // Replace slot 0 with a duplicate of slot 1
    const badPicks = makeR32Picks().map(p =>
      p.slot === 0 ? { slot: 1, teamId: 'duplicate' } : p
    );

    const req = new Request('http://localhost/api/bracket/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 5, picks: badPicks }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('slot 0');
  });

  test('returns 200 with valid R32 picks when round is open', async () => {
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
