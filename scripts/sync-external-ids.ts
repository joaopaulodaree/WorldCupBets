// Maps API-Football fixture IDs to matches in the DB.
// Run ONCE after upgrading to a paid API-Football plan:
//   npx tsx --env-file=.env scripts/sync-external-ids.ts
//
// After this runs, the /api/cron/sync-results endpoint will automatically
// update match statuses and scores.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const API_KEY = process.env.API_FOOTBALL_KEY!;
const BASE_URL = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 1;   // FIFA World Cup
const SEASON = 2026;

interface ApiTeam { id: number; name: string; code: string }
interface ApiFixture {
  fixture: { id: number; date: string };
  teams: { home: ApiTeam; away: ApiTeam };
}

async function fetchAllFixtures(): Promise<ApiFixture[]> {
  const res = await fetch(`${BASE_URL}/fixtures?league=${LEAGUE_ID}&season=${SEASON}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const json = await res.json();

  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football: ${JSON.stringify(json.errors)}`);
  }
  return json.response ?? [];
}

async function run() {
  console.log('Buscando fixtures da Copa 2026 na API-Football...');
  const fixtures = await fetchAllFixtures();
  console.log(`✓ ${fixtures.length} fixtures encontrados`);

  // Load all teams from DB to build a name→code lookup
  const { data: dbTeams } = await supabase.from('teams').select('id, code, name');
  const codeById = new Map<string, string>(); // apiCode → dbTeamId

  // Fetch matches to update
  const { data: dbMatches } = await supabase
    .from('matches')
    .select(`
      id, external_id, kickoff_at,
      home_team:home_team_id(id, code, name),
      away_team:away_team_id(id, code, name)
    `);

  type DbMatch = {
    id: string; external_id: number | null; kickoff_at: string;
    home_team: { id: string; code: string; name: string };
    away_team: { id: string; code: string; name: string };
  };
  const matches = (dbMatches ?? []) as unknown as DbMatch[];

  let mapped = 0;
  let skipped = 0;

  for (const fixture of fixtures) {
    const apiHomeCode = fixture.teams.home.code?.toUpperCase();
    const apiAwayCode = fixture.teams.away.code?.toUpperCase();
    const fixtureDate = fixture.fixture.date.substring(0, 10); // YYYY-MM-DD

    // Find matching DB match by team codes + date (within same calendar day UTC)
    const match = matches.find((m) => {
      const dbDate = m.kickoff_at.substring(0, 10);
      return (
        m.home_team.code === apiHomeCode &&
        m.away_team.code === apiAwayCode &&
        dbDate === fixtureDate
      );
    });

    if (!match) {
      console.log(`  ⚠ No match for: ${apiHomeCode} vs ${apiAwayCode} on ${fixtureDate}`);
      skipped++;
      continue;
    }

    if (match.external_id === fixture.fixture.id) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('matches')
      .update({ external_id: fixture.fixture.id })
      .eq('id', match.id);

    if (error) {
      console.error(`  ✗ ${match.id}: ${error.message}`);
    } else {
      console.log(`  ✓ ${apiHomeCode} vs ${apiAwayCode} → fixture #${fixture.fixture.id}`);
      mapped++;
    }
  }

  console.log(`\nConcluído: ${mapped} mapeados, ${skipped} ignorados`);
  console.log('O cron /api/cron/sync-results agora atualizará os resultados automaticamente.');
}

run().catch((e) => { console.error(e.message); process.exit(1); });
