import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { LeaderboardEntry } from '@/components/leaderboard/LeaderboardRow';

export const dynamic = 'force-dynamic';

function calcPoints(predHome: number, predAway: number, realHome: number, realAway: number): number {
  if (predHome === realHome && predAway === realAway) return 3;
  return Math.sign(predHome - predAway) === Math.sign(realHome - realAway) ? 1 : 0;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  const currentUserId = user?.id ?? null;

  const admin = createAdminClient();

  const [{ data: settledPreds }, { data: liveMatches }] = await Promise.all([
    admin.from('predictions').select('user_id, points').not('points', 'is', null),
    admin.from('matches').select('id, home_goals, away_goals').eq('status', 'live'),
  ]);

  const hasLive = (liveMatches?.length ?? 0) > 0;

  const totals = new Map<string, number>();
  for (const p of settledPreds ?? []) {
    totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
  }

  if (hasLive) {
    for (const match of liveMatches!) {
      if (match.home_goals === null || match.away_goals === null) continue;

      const { data: preds } = await admin
        .from('predictions')
        .select('user_id, home_goals, away_goals')
        .eq('match_id', match.id)
        .is('points', null);

      for (const p of preds ?? []) {
        const pts = calcPoints(p.home_goals, p.away_goals, match.home_goals, match.away_goals);
        totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + pts);
      }
    }
  }

  if (totals.size === 0) {
    return NextResponse.json({ entries: [], hasLive });
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const userIds = sorted.map(([id]) => id);

  const { data: users } = await admin.from('users').select('id, name').in('id', userIds);
  const nameMap = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));

  // Find previous snapshot for delta
  const { data: snapRows } = await admin
    .from('leaderboard_snapshots')
    .select('match_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const seenMatchIds: string[] = [];
  const seen = new Set<string>();
  for (const s of snapRows ?? []) {
    if (!seen.has(s.match_id)) {
      seen.add(s.match_id);
      seenMatchIds.push(s.match_id);
      if (seenMatchIds.length === 2) break;
    }
  }
  const prevMatchId = seenMatchIds[1] ?? null;

  const prevPositionMap = new Map<string, number>();
  if (prevMatchId) {
    const { data: prevSnaps } = await admin
      .from('leaderboard_snapshots')
      .select('user_id, position')
      .eq('match_id', prevMatchId);
    for (const s of prevSnaps ?? []) {
      prevPositionMap.set(s.user_id, s.position);
    }
  }

  const entries: LeaderboardEntry[] = sorted.map(([userId, points], i) => {
    const position = i + 1;
    const prevPosition = prevPositionMap.get(userId);
    const delta = prevPosition != null ? prevPosition - position : null;
    return {
      position,
      name: nameMap.get(userId) ?? 'Desconhecido',
      points,
      delta,
      isCurrentUser: userId === currentUserId,
    };
  });

  return NextResponse.json({ entries, hasLive });
}
