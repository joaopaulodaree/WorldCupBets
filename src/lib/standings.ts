// src/lib/standings.ts
// Pure standings calculation logic — no React dependencies.
// Extracted from GroupStandingsView.tsx for server-side use.

export interface TeamStanding {
  teamId: string;
  name: string;
  code: string;
  flag_url: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface GroupMatchInfo {
  id: string;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished';
  homeTeam: { id: string; name: string; code: string; flag_url: string };
  awayTeam: { id: string; name: string; code: string; flag_url: string };
  homeGoals: number | null;
  awayGoals: number | null;
}

export type LiveOverride = {
  home_goals: number | null;
  away_goals: number | null;
  status: 'live' | 'finished';
};

export function sortStandings(standings: TeamStanding[]): TeamStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export function buildLiveStandings(
  matches: GroupMatchInfo[],
  overrides: Map<string, LiveOverride>,
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>();

  for (const m of matches) {
    if (!standings.has(m.homeTeam.id)) {
      standings.set(m.homeTeam.id, {
        teamId: m.homeTeam.id, name: m.homeTeam.name, code: m.homeTeam.code, flag_url: m.homeTeam.flag_url,
        played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
      });
    }
    if (!standings.has(m.awayTeam.id)) {
      standings.set(m.awayTeam.id, {
        teamId: m.awayTeam.id, name: m.awayTeam.name, code: m.awayTeam.code, flag_url: m.awayTeam.flag_url,
        played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
      });
    }

    const override = overrides.get(m.id);
    const status = override?.status ?? m.status;
    const homeGoals = override?.home_goals ?? m.homeGoals;
    const awayGoals = override?.away_goals ?? m.awayGoals;

    if ((status === 'finished' || status === 'live') && homeGoals !== null && awayGoals !== null) {
      const home = standings.get(m.homeTeam.id)!;
      const away = standings.get(m.awayTeam.id)!;
      home.played++; away.played++;
      home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
      if (homeGoals > awayGoals) { home.wins++; home.points += 3; away.losses++; }
      else if (homeGoals < awayGoals) { away.wins++; away.points += 3; home.losses++; }
      else { home.draws++; away.draws++; home.points++; away.points++; }
    }
  }

  return Array.from(standings.values());
}
