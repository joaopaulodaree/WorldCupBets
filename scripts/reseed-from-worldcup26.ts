// Limpa matches+predictions e reseed direto da worldcup26.ir API.
// Mantém os times existentes (nomes em PT, flag_url), só recria os jogos.
//
//   npx tsx --env-file=.env scripts/reseed-from-worldcup26.ts
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
  groups: string;
}

interface WC26Game {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string;
  away_score: string;
  finished: string;
  time_elapsed: string;
  group: string;
  matchday: string;
  local_date: string; // "MM/DD/YYYY HH:MM" in US EDT (UTC-4)
  type: string;
}

// worldcup26 local_date is in US EDT (UTC-4)
function toUtcIso(localDate: string): string {
  const [datePart, timePart] = localDate.split(' ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 4, minute)).toISOString();
}

function mapStatus(game: WC26Game): 'scheduled' | 'live' | 'finished' {
  if (game.finished === 'TRUE' || game.time_elapsed === 'finished') return 'finished';
  if (game.time_elapsed === 'notstarted') return 'scheduled';
  return 'live';
}

async function run() {
  // 1. Fetch worldcup26 data
  console.log('Buscando dados do worldcup26.ir...');
  const [teamsRes, gamesRes] = await Promise.all([
    fetch(`${BASE_URL}/get/teams`).then((r) => r.json()),
    fetch(`${BASE_URL}/get/games`).then((r) => r.json()),
  ]);

  const wc26Teams: WC26Team[] = Array.isArray(teamsRes) ? teamsRes : (teamsRes.teams ?? []);
  const wc26Games: WC26Game[] = Array.isArray(gamesRes) ? gamesRes : (gamesRes.games ?? []);
  const groupGames = wc26Games.filter((g) => g.type === 'group' && g.home_team_id !== '0');

  console.log(`✓ ${wc26Teams.length} times, ${groupGames.length} jogos da fase de grupos`);

  // 2. Load our DB teams: build fifa_code → DB row map
  const { data: dbTeams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, code, name');
  if (teamsErr) throw new Error(teamsErr.message);

  const dbTeamByCode = new Map<string, { id: string; name: string }>();
  for (const t of dbTeams ?? []) dbTeamByCode.set(t.code.toUpperCase(), t);

  // worldcup26 team id → DB team id
  const wc26IdToDbId = new Map<string, string>();
  let missingTeams = 0;
  for (const t of wc26Teams) {
    const code = t.fifa_code.toUpperCase();
    const dbTeam = dbTeamByCode.get(code);
    if (dbTeam) {
      wc26IdToDbId.set(t.id, dbTeam.id);
    } else {
      console.warn(`  ⚠ Time não encontrado no banco: ${code} (${t.name_en})`);
      missingTeams++;
    }
  }
  if (missingTeams > 0) console.log(`  ${missingTeams} times sem correspondência`);

  // 3. Clear predictions then matches (CASCADE would handle it but let's be explicit)
  console.log('\nLimpando dados existentes...');
  const { error: predErr } = await supabase.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (predErr) throw new Error(`Erro ao limpar predictions: ${predErr.message}`);
  console.log('  ✓ Predictions removidas');

  const { error: matchErr } = await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (matchErr) throw new Error(`Erro ao limpar matches: ${matchErr.message}`);
  console.log('  ✓ Matches removidos');

  // 4. Insert matches from worldcup26
  console.log('\nInserindo jogos...');
  let inserted = 0;
  let skipped = 0;

  for (const game of groupGames) {
    const homeDbId = wc26IdToDbId.get(game.home_team_id);
    const awayDbId = wc26IdToDbId.get(game.away_team_id);

    if (!homeDbId || !awayDbId) {
      console.warn(`  ⚠ Pulando jogo #${game.id}: time não encontrado`);
      skipped++;
      continue;
    }

    const status = mapStatus(game);
    const kickoff_at = toUtcIso(game.local_date);
    const home_goals = status !== 'scheduled' ? parseInt(game.home_score, 10) : null;
    const away_goals = status !== 'scheduled' ? parseInt(game.away_score, 10) : null;

    const { error } = await supabase.from('matches').insert({
      group_name: game.group,
      round: parseInt(game.matchday, 10),
      kickoff_at,
      status,
      home_goals: isNaN(home_goals!) ? null : home_goals,
      away_goals: isNaN(away_goals!) ? null : away_goals,
      home_team_id: homeDbId,
      away_team_id: awayDbId,
      external_id: parseInt(game.id, 10),
    });

    if (error) {
      console.error(`  ✗ Jogo #${game.id}: ${error.message}`);
      skipped++;
    } else {
      inserted++;
    }
  }

  console.log(`\nConcluído: ${inserted} jogos inseridos, ${skipped} ignorados`);
  console.log('O cron sync-results atualizará os resultados automaticamente.');
}

run().catch((e) => { console.error(e.message); process.exit(1); });
