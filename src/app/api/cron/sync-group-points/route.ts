import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildLiveStandings, sortStandings, type GroupMatchInfo } from '@/lib/standings';

export const dynamic = 'force-dynamic';

// Raw shape returned by Supabase for the matches query
interface RawMatch {
  id: string;
  group_name: string;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished';
  home_goals: number | null;
  away_goals: number | null;
  homeTeam: { id: string; name: string; code: string; flag_url: string };
  awayTeam: { id: string; name: string; code: string; flag_url: string };
}

function toGroupMatchInfo(m: RawMatch): GroupMatchInfo {
  return {
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
  };
}

export async function GET(request: Request) {
  // Protect cron endpoint in production
  const authHeader = request.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Only run when all group stage matches are finished
  const { count: unfinished } = await admin
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'finished');

  if ((unfinished ?? 1) > 0) {
    return NextResponse.json({ skipped: true, reason: 'groups not finished', unfinished });
  }

  // Fetch all group matches with team info (needed for buildLiveStandings)
  const { data: matchData, error: matchError } = await admin
    .from('matches')
    .select(`
      id, group_name, kickoff_at, status, home_goals, away_goals,
      homeTeam:home_team_id(id, name, code, flag_url),
      awayTeam:away_team_id(id, name, code, flag_url)
    `)
    .order('kickoff_at', { ascending: true });

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  const rawMatches = (matchData ?? []) as unknown as RawMatch[];

  // Build real standings per group
  const groupNames = [...new Set(rawMatches.map((m) => m.group_name))];
  const realStandingsByGroup = new Map<string, [string, string]>(); // groupName → [1st_teamId, 2nd_teamId]

  for (const groupName of groupNames) {
    const groupMatches = rawMatches
      .filter((m) => m.group_name === groupName)
      .map(toGroupMatchInfo);
    const standings = sortStandings(buildLiveStandings(groupMatches, new Map()));
    realStandingsByGroup.set(groupName, [
      standings[0]?.teamId ?? '',
      standings[1]?.teamId ?? '',
    ]);
  }

  // Fetch all distinct users who have predictions
  const { data: allUserRows } = await admin
    .from('predictions')
    .select('user_id');
  const uniqueUserIds = [
    ...new Set((allUserRows ?? []).map((p: { user_id: string }) => p.user_id)),
  ];

  let updated = 0;

  for (const userId of uniqueUserIds) {
    // Fetch this user's predictions
    const { data: userPreds } = await admin
      .from('predictions')
      .select('match_id, home_goals, away_goals')
      .eq('user_id', userId);

    // Build override map: matchId → { home_goals, away_goals, status: 'finished' }
    const predMap = new Map(
      (userPreds ?? []).map(
        (p: { match_id: string; home_goals: number; away_goals: number }) => [
          p.match_id,
          { home_goals: p.home_goals, away_goals: p.away_goals, status: 'finished' as const },
        ],
      ),
    );

    for (const groupName of groupNames) {
      const groupMatches = rawMatches
        .filter((m) => m.group_name === groupName)
        .map(toGroupMatchInfo);

      const overrides = new Map(
        groupMatches
          .filter((m) => predMap.has(m.id))
          .map((m) => [m.id, predMap.get(m.id)!]),
      );

      const predictedStandings = sortStandings(
        buildLiveStandings(groupMatches, overrides),
      );
      const real = realStandingsByGroup.get(groupName) ?? ['', ''];

      let correctPositions = 0;
      if (predictedStandings[0]?.teamId === real[0]) correctPositions++;
      if (predictedStandings[1]?.teamId === real[1]) correctPositions++;

      await admin
        .from('group_position_points')
        .upsert(
          { user_id: userId, group_name: groupName, correct_positions: correctPositions },
          { onConflict: 'user_id,group_name' },
        );

      updated++;
    }
  }

  return NextResponse.json({ updated });
}
