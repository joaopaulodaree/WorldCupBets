// src/lib/worldcup26/client.ts
const BASE_URL = 'https://worldcup26.ir';

export type FixtureStatus = 'scheduled' | 'live' | 'finished';

export interface FixtureResult {
  externalId: number;
  status: FixtureStatus;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface KnockoutGame {
  externalId: number;
  type: 'r32' | 'r16' | 'qf' | 'sf' | 'final';
  status: FixtureStatus;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeamNameEn: string | null; // null when team TBD (home_team_id="0")
  awayTeamNameEn: string | null;
  localDate: string | null; // "MM/DD/YYYY HH:MM" format
}

interface WorldCupGame {
  id: string;
  home_score: string;
  away_score: string;
  finished: string;
  time_elapsed: string;
  type?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_id?: string;
  away_team_id?: string;
  local_date?: string;
}

interface WorldCupGamesResponse {
  games?: WorldCupGame[];
}

const KNOCKOUT_TYPES = new Set(['r32', 'r16', 'qf', 'sf', 'final']);

function mapStatus(game: WorldCupGame): FixtureStatus {
  if (game.finished === 'TRUE' || game.time_elapsed === 'finished') return 'finished';
  if (game.time_elapsed === 'notstarted') return 'scheduled';
  return 'live';
}

async function fetchAllGames(): Promise<WorldCupGame[]> {
  const res = await fetch(`${BASE_URL}/get/games`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`worldcup26.ir ${res.status}: /get/games`);
  const json: WorldCupGamesResponse | WorldCupGame[] = await res.json();
  return Array.isArray(json) ? json : (json.games ?? []);
}

export async function getAllGames(): Promise<FixtureResult[]> {
  const games = await fetchAllGames();
  return games.map((g) => {
    const status = mapStatus(g);
    const homeGoals = status !== 'scheduled' ? parseInt(g.home_score, 10) : null;
    const awayGoals = status !== 'scheduled' ? parseInt(g.away_score, 10) : null;
    return {
      externalId: parseInt(g.id, 10),
      status,
      homeGoals: isNaN(homeGoals!) ? null : homeGoals,
      awayGoals: isNaN(awayGoals!) ? null : awayGoals,
    };
  });
}

export async function getFinishedAndLiveGames(): Promise<FixtureResult[]> {
  const all = await getAllGames();
  return all.filter((g) => g.status !== 'scheduled');
}

export async function getAllKnockoutGames(): Promise<KnockoutGame[]> {
  const games = await fetchAllGames();
  return games
    .filter((g) => KNOCKOUT_TYPES.has(g.type ?? ''))
    .map((g) => {
      const status = mapStatus(g);
      const homeGoals = status !== 'scheduled' ? parseInt(g.home_score, 10) : null;
      const awayGoals = status !== 'scheduled' ? parseInt(g.away_score, 10) : null;
      const isTbd = g.home_team_id === '0' || !g.home_team_id;
      return {
        externalId: parseInt(g.id, 10),
        type: g.type as KnockoutGame['type'],
        status,
        homeGoals: isNaN(homeGoals!) ? null : homeGoals,
        awayGoals: isNaN(awayGoals!) ? null : awayGoals,
        homeTeamNameEn: isTbd ? null : (g.home_team_name_en ?? null),
        awayTeamNameEn: (g.away_team_id === '0' || !g.away_team_id) ? null : (g.away_team_name_en ?? null),
        localDate: g.local_date ?? null,
      };
    });
}
