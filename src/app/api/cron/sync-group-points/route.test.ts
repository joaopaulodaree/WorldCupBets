import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

describe('GET /api/cron/sync-group-points', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  test('returns 401 in production without Bearer token', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 'secret123');

    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/cron/sync-group-points');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('skips when groups not finished', async () => {
    // NODE_ENV is 'test' by default in vitest — no auth check needed
    const { createAdminClient } = await import('@/lib/supabase/admin');

    // Build a chainable mock that resolves { count: 5 } when neq() is called
    const chain = {
      select: vi.fn(),
      neq: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.neq.mockResolvedValue({ count: 5, data: null, error: null });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof createAdminClient>);

    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/cron/sync-group-points');
    const res = await GET(req);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('groups not finished');
  });
});
