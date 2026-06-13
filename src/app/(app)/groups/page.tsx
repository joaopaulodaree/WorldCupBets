import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  GroupStandingsView,
  type TeamStanding,
  type GroupData,
} from '@/components/groups/GroupStandingsView';

interface TeamRow {
  id: string;
  name: string;
  code: string;
  flag_url: string;
}

interface MatchRow {
  id: string;
  group_name: string;
  round: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished';
  home_goals: number | null;
  away_goals: number | null;
  home_team: TeamRow;
  away_team: TeamRow;
}

interface PredictionRow {
  match_id: string;
  home_goals: number;
  away_goals: number;
}

function initStanding(team: TeamRow): TeamStanding {
  return {
    teamId: team.id,
    name: team.name,
    code: team.code,
    flag_url: team.flag_url,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

function applyResult(
  standings: Map<string, TeamStanding>,
  homeTeam: TeamRow,
  awayTeam: TeamRow,
  homeGoals: number,
  awayGoals: number,
) {
  const home = standings.get(homeTeam.id)!;
  const away = standings.get(awayTeam.id)!;

  home.played++;
  away.played++;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.wins++;
    home.points += 3;
    away.losses++;
  } else if (homeGoals < awayGoals) {
    away.wins++;
    away.points += 3;
    home.losses++;
  } else {
    home.draws++;
    away.draws++;
    home.points++;
    away.points++;
  }
}

function buildStandings(
  matches: MatchRow[],
  getScore: (m: MatchRow) => { homeGoals: number; awayGoals: number } | null,
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>();

  for (const m of matches) {
    if (!standings.has(m.home_team.id)) standings.set(m.home_team.id, initStanding(m.home_team));
    if (!standings.has(m.away_team.id)) standings.set(m.away_team.id, initStanding(m.away_team));
  }

  let scored = 0;
  for (const m of matches) {
    const score = getScore(m);
    if (!score) continue;
    applyResult(standings, m.home_team, m.away_team, score.homeGoals, score.awayGoals);
    scored++;
  }

  return Array.from(standings.values());
}

export default async function GroupsPage() {
  const admin = createAdminClient();

  const { data: matchData, error } = await admin
    .from('matches')
    .select(`
      id, group_name, round, kickoff_at, status, home_goals, away_goals,
      home_team:home_team_id(id, name, code, flag_url),
      away_team:away_team_id(id, name, code, flag_url)
    `)
    .order('group_name', { ascending: true })
    .order('round', { ascending: true });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary">Erro ao carregar grupos: {error.message}</p>
      </div>
    );
  }

  const matches = (matchData ?? []) as unknown as MatchRow[];

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  const predictionMap = new Map<string, PredictionRow>();
  if (user) {
    const { data: preds } = await admin
      .from('predictions')
      .select('match_id, home_goals, away_goals')
      .eq('user_id', user.id);

    for (const p of preds ?? []) {
      predictionMap.set(p.match_id, p);
    }
  }

  // Group matches by group_name
  const byGroup = new Map<string, MatchRow[]>();
  for (const m of matches) {
    const g = m.group_name;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }

  const groupOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const groups: GroupData[] = groupOrder
    .map((g) => {
      const gMatches = byGroup.get(g) ?? [];
      const finishedCount = gMatches.filter((m) => m.status === 'finished').length;
      const predictedCount = gMatches.filter((m) => predictionMap.has(m.id)).length;

      const realStandings = buildStandings(gMatches, (m) => {
        if (m.status !== 'finished' || m.home_goals === null || m.away_goals === null) return null;
        return { homeGoals: m.home_goals, awayGoals: m.away_goals };
      });

      // Predicted: real result if finished, otherwise prediction
      const predictedStandings = buildStandings(gMatches, (m) => {
        if (m.status === 'finished' && m.home_goals !== null && m.away_goals !== null) {
          return { homeGoals: m.home_goals, awayGoals: m.away_goals };
        }
        const pred = predictionMap.get(m.id);
        if (!pred) return null;
        return { homeGoals: pred.home_goals, awayGoals: pred.away_goals };
      });

      return { name: g, realStandings, predictedStandings, finishedCount, predictedCount };
    });

  return (
    <GroupStandingsView
      groups={groups}
      isAuthenticated={!!user}
    />
  );
}
