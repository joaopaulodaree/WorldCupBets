import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFinishedAndLiveGames } from '@/lib/worldcup26/client';

// Uses service role to bypass RLS on writes
function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Protect cron endpoint in production
  const authHeader = request.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();

    // Sync all non-finished matches that have been mapped to worldcup26.
    // worldcup26 returns all 104 games in one request, so there's no cost
    // to checking every unfinished match each run.
    const { data: relevantMatches } = await supabase
      .from('matches')
      .select('id, external_id, status')
      .neq('status', 'finished')
      .not('external_id', 'is', null);

    if (!relevantMatches?.length) {
      return NextResponse.json({ synced: 0, message: 'No matches to sync' });
    }

    // Fetch live/recent results from worldcup26.ir
    const results = await getFinishedAndLiveGames();
    const resultMap = new Map(results.map((r) => [r.externalId, r]));

    function calcPoints(predHome: number, predAway: number, realHome: number, realAway: number): number {
      if (predHome === realHome && predAway === realAway) return 3;
      return Math.sign(predHome - predAway) === Math.sign(realHome - realAway) ? 1 : 0;
    }

    let synced = 0;
    for (const match of relevantMatches) {
      const result = resultMap.get(match.external_id);
      if (!result) continue;
      if (result.status === match.status && result.status === 'scheduled') continue;

      await supabase
        .from('matches')
        .update({
          status: result.status,
          home_goals: result.homeGoals,
          away_goals: result.awayGoals,
        })
        .eq('id', match.id);

      // Calculate prediction points for newly finished matches
      if (result.status === 'finished' && result.homeGoals !== null && result.awayGoals !== null) {
        const { data: preds } = await supabase
          .from('predictions')
          .select('id, home_goals, away_goals')
          .eq('match_id', match.id)
          .is('points', null);

        for (const p of preds ?? []) {
          const pts = calcPoints(p.home_goals, p.away_goals, result.homeGoals!, result.awayGoals!);
          await supabase.from('predictions').update({ points: pts }).eq('id', p.id);
        }

        // Snapshot the full leaderboard after this match's points are settled
        const { data: allScored } = await supabase
          .from('predictions')
          .select('user_id, points')
          .not('points', 'is', null);

        const totals = new Map<string, number>();
        for (const p of allScored ?? []) {
          totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
        }

        const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
        const snapshots = ranked.map(([userId, pts], i) => ({
          match_id: match.id,
          user_id: userId,
          position: i + 1,
          points: pts,
        }));

        if (snapshots.length > 0) {
          await supabase
            .from('leaderboard_snapshots')
            .upsert(snapshots, { onConflict: 'match_id,user_id' });
        }
      }

      synced++;
    }

    return NextResponse.json({ synced });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
