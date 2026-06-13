'use server';

import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { LeaderboardEntry } from '@/components/leaderboard/LeaderboardRow';
import { LeaderboardClient } from '@/components/leaderboard/LeaderboardClient';

async function getLeaderboard(currentUserId: string | null): Promise<{ entries: LeaderboardEntry[]; hasLive: boolean }> {
  const admin = createAdminClient();

  // 1. All scored predictions + live matches in parallel
  const [{ data: predData }, { data: liveMatches }] = await Promise.all([
    admin.from('predictions').select('user_id, points').not('points', 'is', null),
    admin.from('matches').select('id').eq('status', 'live').limit(1),
  ]);

  const hasLive = (liveMatches?.length ?? 0) > 0;

  if (!predData?.length) return { entries: [], hasLive };

  // 2. Aggregate points per user
  const totals = new Map<string, number>();
  for (const p of predData) {
    totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
  }

  // 3. Sort descending and assign current positions
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const userIds = sorted.map(([id]) => id);

  // 4. Fetch user names
  const { data: users } = await admin
    .from('users')
    .select('id, name')
    .in('id', userIds);
  const nameMap = new Map(
    (users ?? []).map((u: { id: string; name: string }) => [u.id, u.name])
  );

  // 5. Find the two most recent distinct match_ids that have snapshots.
  //    seenMatchIds[0] = most recent (= current state), seenMatchIds[1] = previous.
  //    We compare live vs previous to show the delta caused by the last processed match.
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

  // 6. Fetch previous snapshot positions
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

  // 7. Build final entries
  const entries = sorted.map(([userId, points], i) => {
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
