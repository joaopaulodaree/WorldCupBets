const BASE_URL = 'https://v3.football.api-sports.io';

function getApiKey(): string {
  const key = process.env.API_FOOTBALL_KEY ?? process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
  if (!key) throw new Error('API_FOOTBALL_KEY não configurada');
  return key;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': getApiKey() },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`API-Football ${res.status}: ${path}`);

  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    const msg = JSON.stringify(json.errors);
    // Surface plan errors clearly so the cron endpoint can return a useful message
    if (msg.includes('plan')) throw Object.assign(new Error(msg), { planError: true });
    throw new Error(`API-Football error: ${msg}`);
  }

  return json.response as T;
}

export type FixtureStatus = 'scheduled' | 'live' | 'finished';

export interface FixtureResult {
  externalId: number;
  status: FixtureStatus;
  homeGoals: number | null;
  awayGoals: number | null;
}

interface ApiFixture {
  fixture: {
    id: number;
    status: { short: string };
  };
  goals: { home: number | null; away: number | null };
}

function mapStatus(short: string): FixtureStatus {
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  return 'scheduled';
}

export async function getFixtureResult(externalId: number): Promise<FixtureResult> {
  const fixtures = await apiFetch<ApiFixture[]>(`/fixtures?id=${externalId}`);
  if (!fixtures.length) throw new Error(`Fixture ${externalId} not found`);

  const f = fixtures[0];
  return {
    externalId: f.fixture.id,
    status: mapStatus(f.fixture.status.short),
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
  };
}

export async function getLiveAndRecentFixtures(leagueId = 1, season = 2026): Promise<FixtureResult[]> {
  const fixtures = await apiFetch<ApiFixture[]>(
    `/fixtures?league=${leagueId}&season=${season}&status=1H-2H-HT-ET-BT-P-FT-AET-PEN`
  );

  return fixtures.map((f) => ({
    externalId: f.fixture.id,
    status: mapStatus(f.fixture.status.short),
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
  }));
}
