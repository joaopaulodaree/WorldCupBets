const BASE_URL = 'https://worldcup26.ir';

export type FixtureStatus = 'scheduled' | 'live' | 'finished';

export interface FixtureResult {
  externalId: number;
  status: FixtureStatus;
  homeGoals: number | null;
  awayGoals: number | null;
}

interface WorldCupGame {
  id: string;
  home_score: string;
  away_score: string;
  finished: string;
  time_elapsed: string;
}

interface WorldCupGamesResponse {
  games?: WorldCupGame[];
}

function mapStatus(game: WorldCupGame): FixtureStatus {
  if (game.finished === 'TRUE' || game.time_elapsed === 'finished') return 'finished';
  if (game.time_elapsed === 'notstarted') return 'scheduled';
  return 'live';
}

export async function getAllGames(): Promise<FixtureResult[]> {
  const res = await fetch(`${BASE_URL}/get/games`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`worldcup26.ir ${res.status}: /get/games`);

  const json: WorldCupGamesResponse | WorldCupGame[] = await res.json();
  const games: WorldCupGame[] = Array.isArray(json) ? json : (json.games ?? []);

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
