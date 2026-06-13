import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFinishedAndLiveGames } from '@/lib/worldcup26/client';

export const dynamic = 'force-dynamic';

// Module-level throttle: shared across warm serverless instances.
let lastSyncAt = 0;
const SYNC_THROTTLE_MS = 25_000;

async function syncStartedMatches() {
  lastSyncAt = Date.now(); // set early to block concurrent syncs
  const admin = createAdminClient();

  // All non-finished matches that have already kicked off
  const { data: candidates } = await admin
    .from('matches')
    .select('id, external_id, status')
    .neq('status', 'finished')
    .not('external_id', 'is', null)
    .lte('kickoff_at', new Date().toISOString());

  if (!candidates?.length) return;

  const results = await getFinishedAndLiveGames();
  const resultMap = new Map(results.map((r) => [r.externalId, r]));

  await Promise.all(
    candidates.map((match) => {
      const result = resultMap.get(match.external_id);
      if (!result) return Promise.resolve();
      if (result.status === match.status && result.status !== 'live') return Promise.resolve();
      return admin
        .from('matches')
        .update({ status: result.status, home_goals: result.homeGoals, away_goals: result.awayGoals })
        .eq('id', match.id);
    })
  );
}

export async function GET() {
  const admin = createAdminClient();

  // Check for live matches OR scheduled matches past kickoff
  const { data: started } = await admin
    .from('matches')
    .select('id, home_goals, away_goals, status')
    .neq('status', 'finished')
    .lte('kickoff_at', new Date().toISOString());

  const hasStarted = (started?.length ?? 0) > 0;

  if (hasStarted && Date.now() - lastSyncAt > SYNC_THROTTLE_MS) {
    await syncStartedMatches();

    const { data: fresh } = await admin
      .from('matches')
      .select('id, home_goals, away_goals, status')
      .eq('status', 'live');

    return NextResponse.json({ matches: fresh ?? [], hasLive: (fresh?.length ?? 0) > 0 });
  }

  const live = (started ?? []).filter((m) => m.status === 'live');
  return NextResponse.json({ matches: live, hasLive: live.length > 0 });
}
