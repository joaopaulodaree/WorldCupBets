'use server';

import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { LeaderboardEntry } from '@/components/leaderboard/LeaderboardRow';
import { LeaderboardClient } from '@/components/leaderboard/LeaderboardClient';

async function getLeaderboard(currentUserId: string | null): Promise<{ entries: LeaderboardEntry[]; hasLive: boolean }> {
  const admin = createAdminClient();

  // Fetch all three point sources + live match check in parallel
  const [{ data: predData }, { data: liveMatches }, { data: groupPts }, { data: bracketPts }] = await Promise.all([
    admin.from('predictions').select('user_id, points'),
    admin.from('matches').select('id').eq('status', 'live').limit(1),
    admin.from('group_position_points').select('user_id, correct_positions'),
    admin.from('bracket_picks').select('user_id, points').eq('is_submitted', true),
  ]);

  const hasLive = (liveMatches?.length ?? 0) > 0;

  if (!predData?.length && !groupPts?.length && !bracketPts?.length) {
    return { entries: [], hasLive };
  }

  // Aggregate jogos_pts
  const jogosTotals = new Map<string, number>();
  for (const p of predData ?? []) {
    if (!jogosTotals.has(p.user_id)) jogosTotals.set(p.user_id, 0);
    if (p.points != null) jogosTotals.set(p.user_id, (jogosTotals.get(p.user_id) ?? 0) + p.points);
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

  if (allUserIds.size === 0) return { entries: [], hasLive };

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

  // Fetch names
  const { data: users } = await admin.from('users').select('id, name').in('id', userIds);
  const nameMap = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));

  // Delta logic (unchanged from existing)
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

  return { entries, hasLive };
}

export default async function LeaderboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  let entries: LeaderboardEntry[] = [];
  let hasLive = false;
  let error: string | null = null;

  try {
    ({ entries, hasLive } = await getLeaderboard(user?.id ?? null));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro ao carregar ranking';
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-green mb-2">Ranking Global</h1>
        <p className="text-secondary">Quem está ganhando o bolão?</p>
      </div>

      {error ? (
        <div className="text-center py-12">
          <p className="text-secondary">Erro ao carregar ranking: {error}</p>
        </div>
      ) : (
        <LeaderboardClient initialEntries={entries} initialHasLive={hasLive} />
      )}
    </div>
  );
}
