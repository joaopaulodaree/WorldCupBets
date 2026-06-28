import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const ROUND_POINTS: Record<number, number> = {
  5: 1,   // R32
  6: 2,   // R16
  7: 4,   // QF
  8: 8,   // SF
  9: 16,  // Final
};

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch all knockout matches with a known winner
  const { data: finishedMatches } = await admin
    .from('knockout_matches')
    .select('round, slot, winner_team_id')
    .not('winner_team_id', 'is', null);

  if (!finishedMatches?.length) {
    return NextResponse.json({ updated: 0, message: 'No finished knockout matches yet' });
  }

  let updated = 0;
  for (const match of finishedMatches) {
    const pointsIfCorrect = ROUND_POINTS[match.round] ?? 0;

    // Fetch all submitted picks for this round+slot
    const { data: picks } = await admin
      .from('bracket_picks')
      .select('id, team_id')
      .eq('round', match.round)
      .eq('slot', match.slot)
      .eq('is_submitted', true);

    for (const pick of picks ?? []) {
      const isCorrect = pick.team_id === match.winner_team_id;
      await admin
        .from('bracket_picks')
        .update({ is_correct: isCorrect, points: isCorrect ? pointsIfCorrect : 0 })
        .eq('id', pick.id);
      updated++;
    }
  }

  return NextResponse.json({ updated });
}
