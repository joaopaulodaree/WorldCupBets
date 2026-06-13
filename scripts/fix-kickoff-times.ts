// Recalcula os kickoff_at de todos os jogos usando o fuso correto de cada estádio.
// Eastern (US/CA): UTC-4 | Central (US): UTC-5 | Central (MX): UTC-6 | Western: UTC-7
//
//   npx tsx --env-file=.env scripts/fix-kickoff-times.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BASE_URL = 'https://worldcup26.ir';

// UTC offset in hours for each stadium (summer 2026, DST applied)
const STADIUM_UTC_OFFSET: Record<string, number> = {
  '1': -6,  // Mexico City (CST, sem horário de verão desde 2022)
  '2': -6,  // Guadalajara
  '3': -6,  // Monterrey
  '4': -5,  // Dallas (CDT)
  '5': -5,  // Houston
  '6': -5,  // Kansas City
  '7': -4,  // Atlanta (EDT)
  '8': -4,  // Miami
  '9': -4,  // Boston
  '10': -4, // Philadelphia
  '11': -4, // New York/New Jersey
  '12': -4, // Toronto
  '13': -7, // Vancouver (PDT)
  '14': -7, // Seattle
  '15': -7, // San Francisco
  '16': -7, // Los Angeles
};

function toUtcIso(localDate: string, offsetHours: number): string {
  const [datePart, timePart] = localDate.split(' ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  // Subtract offset (e.g. UTC-5 → add 5 hours to get UTC)
  return new Date(Date.UTC(year, month - 1, day, hour - offsetHours, minute)).toISOString();
}

async function run() {
  console.log('Buscando jogos do worldcup26.ir...');
  const res = await fetch(`${BASE_URL}/get/games`);
  const json = await res.json();
  const games: any[] = Array.isArray(json) ? json : (json.games ?? []);
  const groupGames = games.filter((g) => g.type === 'group' && g.home_team_id !== '0');
  console.log(`✓ ${groupGames.length} jogos da fase de grupos`);

  // Load DB matches by external_id
  const { data: dbMatches } = await supabase
    .from('matches')
    .select('id, external_id, kickoff_at, status');

  const matchByExtId = new Map<number, { id: string; kickoff_at: string; status: string }>();
  for (const m of dbMatches ?? []) {
    matchByExtId.set(m.external_id, m);
  }

  let updated = 0;
  let skipped = 0;

  for (const game of groupGames) {
    const offset = STADIUM_UTC_OFFSET[game.stadium_id];
    if (offset === undefined) {
      console.warn(`  ⚠ Estádio desconhecido: ${game.stadium_id} (jogo #${game.id})`);
      skipped++;
      continue;
    }

    const kickoff_at = toUtcIso(game.local_date, offset);
    const dbMatch = matchByExtId.get(parseInt(game.id, 10));

    if (!dbMatch) {
      console.warn(`  ⚠ Jogo #${game.id} não encontrado no banco`);
      skipped++;
      continue;
    }

    // Skip if kickoff is already correct
    const existingIso = new Date(dbMatch.kickoff_at).toISOString();
    if (existingIso === kickoff_at) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('matches')
      .update({ kickoff_at })
      .eq('id', dbMatch.id);

    if (error) {
      console.error(`  ✗ Jogo #${game.id}: ${error.message}`);
    } else {
      const h = game.home_team_name_en?.slice(0, 10) ?? '?';
      const a = game.away_team_name_en?.slice(0, 10) ?? '?';
      console.log(`  ✓ #${game.id} ${h} vs ${a}: ${existingIso.slice(11,16)} → ${kickoff_at.slice(11,16)} UTC`);
      updated++;
    }
  }

  console.log(`\nConcluído: ${updated} atualizados, ${skipped} sem mudança`);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
