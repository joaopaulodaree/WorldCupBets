// One-off test script: mark MEX vs RSA (Group A Round 1) as finished with a result
// Run: npx tsx --env-file=.env scripts/test-finish-match.ts
// Undo: npx tsx --env-file=.env scripts/test-finish-match.ts --undo
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const undo = process.argv.includes('--undo');

async function run() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, code')
    .in('code', ['MEX', 'RSA']);

  const teamMap = Object.fromEntries(
    (teams ?? []).map((t: { id: string; code: string }) => [t.code, t.id])
  );

  if (undo) {
    await supabase
      .from('matches')
      .update({ status: 'scheduled', home_goals: null, away_goals: null })
      .eq('home_team_id', teamMap['MEX'])
      .eq('away_team_id', teamMap['RSA']);
    console.log('✓ MEX vs RSA reset to scheduled');
  } else {
    await supabase
      .from('matches')
      .update({ status: 'finished', home_goals: 2, away_goals: 0 })
      .eq('home_team_id', teamMap['MEX'])
      .eq('away_team_id', teamMap['RSA']);
    console.log('✓ MEX vs RSA → finished 2-0');
  }
}

run().catch((e) => { console.error(e.message); process.exit(1); });
