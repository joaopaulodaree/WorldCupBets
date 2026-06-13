import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Group H Round 3 was incorrectly set to June 23 (only 1 day after Round 2).
// Correct date is June 28, consistent with the ~6-day gap pattern.
async function fixDates() {
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, code')
    .in('code', ['ESP', 'CPV', 'URU', 'KSA']);

  if (teamsErr) throw teamsErr;

  const teamMap = Object.fromEntries((teams ?? []).map((t: { id: string; code: string }) => [t.code, t.id]));

  const fixes = [
    { home: 'ESP', away: 'CPV', newKickoff: '2026-06-28T17:00:00Z' },
    { home: 'URU', away: 'KSA', newKickoff: '2026-06-28T17:00:00Z' },
  ];

  for (const fix of fixes) {
    const { error } = await supabase
      .from('matches')
      .update({ kickoff_at: fix.newKickoff })
      .eq('home_team_id', teamMap[fix.home])
      .eq('away_team_id', teamMap[fix.away])
      .eq('group_name', 'H')
      .eq('round', 3);

    if (error) {
      console.error(`Erro ao atualizar ${fix.home} vs ${fix.away}:`, error.message);
    } else {
      console.log(`✓ ${fix.home} vs ${fix.away}: ${fix.newKickoff}`);
    }
  }

  console.log('Correção concluída!');
}

fixDates().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
