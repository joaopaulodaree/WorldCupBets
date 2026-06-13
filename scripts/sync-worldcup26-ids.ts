// Maps worldcup26.ir game IDs to matches in the DB.
// Run ONCE (or re-run to catch new matches):
//   npx tsx --env-file=.env scripts/sync-worldcup26-ids.ts
//
// After this runs, the /api/cron/sync-results endpoint will automatically
// update match statuses and scores using the free worldcup26.ir API.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BASE_URL = 'https://worldcup26.ir';

interface WC26Team {
  id: string;
  fifa_code: string;
  name_en: string;
}

interface WC26Game {
  id: string;
  home_team_id: string;
  away_team_id: string;
  matchday: string;
  group: string;
}

async function run() {
  console.log('Buscando times do worldcup26.ir...');
  const teamsRes = await fetch(`${BASE_URL}/get/teams`);
  const teamsJson = await teamsRes.json();
  const wc26Teams: WC26Team[] = Array.isArray(teamsJson) ? teamsJson : (teamsJson.teams ?? []);

  // Build map: worldcup26 team ID → FIFA code
  const teamIdToCode = new Map<string, string>();
  for (const t of wc26Teams) {
    teamIdToCode.set(t.id, t.fifa_code.toUpperCase());
  }
  console.log(`✓ ${wc26Teams.length} times carregados`);

  console.log('Buscando jogos do worldcup26.ir...');
  const gamesRes = await fetch(`${BASE_URL}/get/games`);
  const gamesJson = await gamesRes.json();
  const wc26Games: WC26Game[] = Array.isArray(gamesJson) ? gamesJson : (gamesJson.games ?? []);
  console.log(`✓ ${wc26Games.length} jogos encontrados`);

  // Load all DB matches with team codes
  const { data: dbMatches, error } = await supabase
    .from('matches')
    .select(`
      id, external_id, round,
      home_team:home_team_id(code),
      away_team:away_team_id(code)
    `);

  if (error) throw new Error(error.message);

  type DbMatch = {
    id: string;
    external_id: number | null;
    round: number;
    home_team: { code: string };
    away_team: { code: string };
  };
  const matches = (dbMatches ?? []) as unknown as DbMatch[];
  console.log(`✓ ${matches.length} partidas no banco`);

  let mapped = 0;
  let skipped = 0;
  let notFound = 0;

  for (const game of wc26Games) {
    const homeCode = teamIdToCode.get(game.home_team_id);
    const awayCode = teamIdToCode.get(game.away_team_id);
    const round = parseInt(game.matchday, 10);

    if (!homeCode || !awayCode) {
      console.log(`  ⚠ Time não encontrado: home_id=${game.home_team_id} away_id=${game.away_team_id}`);
      notFound++;
      continue;
    }

    // Try exact match (home/away + round), then swapped, then just team pair.
    // Fallback to team pair handles groups where our seed has different round
    // pairings than worldcup26 (each pair of teams is still unique in a group).
    const dbMatch =
      matches.find(
        (m) =>
          m.home_team.code === homeCode &&
          m.away_team.code === awayCode &&
          m.round === round,
      ) ??
      matches.find(
        (m) =>
          m.home_team.code === awayCode &&
          m.away_team.code === homeCode &&
          m.round === round,
      ) ??
      matches.find(
        (m) =>
          (m.home_team.code === homeCode && m.away_team.code === awayCode) ||
          (m.home_team.code === awayCode && m.away_team.code === homeCode),
      );

    if (!dbMatch) {
      console.log(`  ⚠ Sem partida no banco: ${homeCode} vs ${awayCode} rodada ${round}`);
      notFound++;
      continue;
    }

    const wc26Id = parseInt(game.id, 10);
    if (dbMatch.external_id === wc26Id) {
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({ external_id: wc26Id })
      .eq('id', dbMatch.id);

    if (updateError) {
      console.error(`  ✗ ${dbMatch.id}: ${updateError.message}`);
    } else {
      console.log(`  ✓ ${homeCode} vs ${awayCode} R${round} → ID #${wc26Id}`);
      mapped++;
    }
  }

  console.log(`\nConcluído: ${mapped} mapeados, ${skipped} já corretos, ${notFound} não encontrados`);
  if (mapped > 0) {
    console.log('O cron /api/cron/sync-results agora atualizará os resultados automaticamente.');
  }
}

run().catch((e) => { console.error(e.message); process.exit(1); });
