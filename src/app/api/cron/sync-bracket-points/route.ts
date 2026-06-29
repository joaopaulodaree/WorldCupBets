import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function calcPoints(
  predHome: number | null,
  predAway: number | null,
  realHome: number | null,
  realAway: number | null,
  isCorrectWinner: boolean,
): number {
  if (!isCorrectWinner) return 0;
  if (predHome !== null && predAway !== null && realHome !== null && realAway !== null) {
    if (predHome === realHome && predAway === realAway) return 3;
  }
  return 1;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: finishedMatches } = await admin
    .from('knockout_matches')
    .select('round, slot, winner_team_id, home_score, away_score')
    .not('winner_team_id', 'is', null);

  if (!finishedMatches?.length) {
    return NextResponse.json({ updated: 0, message: 'No finished knockout matches yet' });
  }

  let updated = 0;
  for (const match of finishedMatches) {
    const { data: picks } = await admin
      .from('bracket_picks')
      .select('id, team_id, home_goals, away_goals')
      .eq('round', match.round)
      .eq('slot', match.slot)
      .eq('is_submitted', true);

    for (const pick of picks ?? []) {
      const isCorrect = pick.team_id === match.winner_team_id;
      const pts = calcPoints(pick.home_goals, pick.away_goals, match.home_score, match.away_score, isCorrect);
      await admin
        .from('bracket_picks')
        .update({ is_correct: isCorrect, points: pts })
        .eq('id', pick.id);
      updated++;
    }
  }

  return NextResponse.json({ updated });
}
