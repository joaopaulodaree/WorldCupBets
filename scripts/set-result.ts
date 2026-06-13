// Manually enter a match result and recalculate prediction points.
// Usage: npx tsx --env-file=.env scripts/set-result.ts <HOME_CODE> <AWAY_CODE> <HOME_GOALS> <AWAY_GOALS>
// Example: npx tsx --env-file=.env scripts/set-result.ts MEX RSA 2 0
//
// To undo (mark back to scheduled): add --undo flag
// Example: npx tsx --env-file=.env scripts/set-result.ts MEX RSA 2 0 --undo
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function calcPoints(predHome: number, predAway: number, realHome: number, realAway: number): number {
  if (predHome === realHome && predAway === realAway) return 3;
  const predOutcome = Math.sign(predHome - predAway);
  const realOutcome = Math.sign(realHome - realAway);
  return predOutcome === realOutcome ? 1 : 0;
}

async function run() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const undo = process.argv.includes('--undo');

  if (args.length < 4) {
    console.error('Usage: set-result.ts <HOME_CODE> <AWAY_CODE> <HOME_GOALS> <AWAY_GOALS> [--undo]');
    process.exit(1);
  }

  const [homeCode, awayCode] = [args[0].toUpperCase(), args[1].toUpperCase()];
  const homeGoals = parseInt(args[2], 10);
  const awayGoals = parseInt(args[3], 10);

  if (isNaN(homeGoals) || isNaN(awayGoals)) {
    console.error('Goals must be numbers');
    process.exit(1);
  }

  // Find teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, code, name')
    .in('code', [homeCode, awayCode]);

  const teamMap = Object.fromEntries(
    (teams ?? []).map((t: { id: string; code: string; name: string }) => [t.code, t])
  );

  if (!teamMap[homeCode]) { console.error(`Team not found: ${homeCode}`); process.exit(1); }
  if (!teamMap[awayCode]) { console.error(`Team not found: ${awayCode}`); process.exit(1); }

  // Find match
  const { data: matches } = await supabase
    .from('matches')
    .select('id, status')
    .eq('home_team_id', teamMap[homeCode].id)
    .eq('away_team_id', teamMap[awayCode].id);

  if (!matches?.length) {
    console.error(`Match not found: ${homeCode} vs ${awayCode}`);
    process.exit(1);
  }

  const match = matches[0];

  if (undo) {
    await supabase
      .from('matches')
      .update({ status: 'scheduled', home_goals: null, away_goals: null })
      .eq('id', match.id);

    // Reset prediction points
    await supabase
      .from('predictions')
      .update({ points: null })
      .eq('match_id', match.id);

    console.log(`✓ ${homeCode} vs ${awayCode} reset to scheduled`);
    return;
  }

  // Update match
  await supabase
    .from('matches')
    .update({ status: 'finished', home_goals: homeGoals, away_goals: awayGoals })
    .eq('id', match.id);

  console.log(`✓ ${teamMap[homeCode].name} ${homeGoals}–${awayGoals} ${teamMap[awayCode].name}`);

  // Fetch all predictions for this match and calculate points
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, home_goals, away_goals')
    .eq('match_id', match.id);

  let updated = 0;
  for (const p of predictions ?? []) {
    const pts = calcPoints(p.home_goals, p.away_goals, homeGoals, awayGoals);
    await supabase
      .from('predictions')
      .update({ points: pts })
      .eq('id', p.id);
    updated++;
  }

  console.log(`✓ ${updated} palpites atualizados`);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
