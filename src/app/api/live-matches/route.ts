import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFinishedAndLiveGames } from '@/lib/worldcup26/client';

export const dynamic = 'force-dynamic';

// Module-level throttle: shared across warm serverless instances.
// Prevents hammering worldcup26.ir when multiple clients poll simultaneously.
let lastSyncAt = 0;
const SYNC_THROTTLE_MS = 25_000;

async function syncLiveScores() {
  lastSyncAt = Date.now(); // set early to prevent concurrent syncs
  const admin = createAdminClient();

  const { data: liveInDb } = await admin
    .from('matches')
    .select('id, external_id')
    .eq('status', 'live');

  if (!liveInDb?.length) return;

  const results = await getFinishedAndLiveGames();
  const resultMap = new Map(results.map((r) => [r.externalId, r]));

  await Promise.all(
    liveInDb.map((match) => {
      const result = resultMap.get(match.external_id);
      if (!result) return Promise.resolve();
      return admin
        .from('matches')
        .update({ status: result.status, home_goals: result.homeGoals, away_goals: result.awayGoals })
        .eq('id', match.id);
    })
  );
}

export async function GET() {
  const admin = createAdminClient();

  const { data } = await admin
    .from('matches')
    .select('id, home_goals, away_goals, status')
    .eq('status', 'live');

  const hasLive = (data?.length ?? 0) > 0;

  if (hasLive && Date.now() - lastSyncAt > SYNC_THROTTLE_MS) {
    await syncLiveScores();

    // Re-query after sync to return fresh scores
    const { data: fresh } = await admin
      .from('matches')
      .select('id, home_goals, away_goals, status')
      .eq('status', 'live');

    return NextResponse.json({ matches: fresh ?? [], hasLive: (fresh?.length ?? 0) > 0 });
  }

  return NextResponse.json({ matches: data ?? [], hasLive });
}
