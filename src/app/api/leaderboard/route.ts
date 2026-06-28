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

  const [{ data: allPreds }, { data: liveMatches }, { data: groupPts }, { data: bracketPts }] = await Promise.all([
    admin.from('predictions').select('user_id, points'),
    admin.from('matches').select('id, home_goals, away_goals').eq('status', 'live'),
    admin.from('group_position_points').select('user_id, correct_positions'),
    admin.from('bracket_picks').select('user_id, points').eq('is_submitted', true),
  ]);

  const hasLive = (liveMatches?.length ?? 0) > 0;

  // Aggregate jogos_pts (match prediction points)
  const jogosTotals = new Map<string, number>();
  for (const p of allPreds ?? []) {
    if (!jogosTotals.has(p.user_id)) jogosTotals.set(p.user_id, 0);
    if (p.points != null) jogosTotals.set(p.user_id, (jogosTotals.get(p.user_id) ?? 0) + p.points);
  }

  // Add live in-progress points to jogos totals
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
        jogosTotals.set(p.user_id, (jogosTotals.get(p.user_id) ?? 0) + pts);
      }
    }
  }

  // Aggregate grupo_pts
  const grupoTotals = new Map<string, number>();
  for (const g of groupPts ?? []) {
    grupoTotals.set(g.user_id, (grupoTotals.get(g.user_id) ?? 0) + g.correct_positions);
  }

  // Aggregate bracket_pts
  const bracketTotals = new Map<string, number>();
  for (const b of bracketPts ?? []) {
    if (b.points != null) {
      bracketTotals.set(b.user_id, (bracketTotals.get(b.user_id) ?? 0) + b.points);
    }
  }

  // Union all user IDs
  const allUserIds = new Set([
    ...jogosTotals.keys(),
    ...grupoTotals.keys(),
    ...bracketTotals.keys(),
  ]);

  if (allUserIds.size === 0) {
    return NextResponse.json({ entries: [], hasLive });
  }

  // Sort by total descending
  const sorted = [...allUserIds]
    .map(uid => ({
      userId: uid,
      jogosPts: jogosTotals.get(uid) ?? 0,
      grupoPts: grupoTotals.get(uid) ?? 0,
      bracketPts: bracketTotals.get(uid) ?? 0,
      total: (jogosTotals.get(uid) ?? 0) + (grupoTotals.get(uid) ?? 0) + (bracketTotals.get(uid) ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  const userIds = sorted.map(s => s.userId);

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

  const entries: LeaderboardEntry[] = sorted.map((s, i) => {
    const position = i + 1;
    const prevPosition = prevPositionMap.get(s.userId);
    const delta = prevPosition != null ? prevPosition - position : null;
    return {
      position,
      name: nameMap.get(s.userId) ?? 'Desconhecido',
      points: s.total,
      jogos_pts: s.jogosPts,
      grupo_pts: s.grupoPts,
      bracket_pts: s.bracketPts,
      delta,
      isCurrentUser: s.userId === currentUserId,
    };
  });

  return NextResponse.json({ entries, hasLive });
}
