// src/lib/knockout/bracketLogic.ts

export type TeamInfo = { id: string; name: string; code: string; flagUrl: string };
export type ScorePick = { homeGoals: string; awayGoals: string };
export type ScorePicks = Record<string, ScorePick>; // key = "round-slot"

export const ROUNDS = [5, 6, 7, 8, 9];
export const ROUND_SLOTS: Record<number, number> = { 5: 16, 6: 8, 7: 4, 8: 2, 9: 1 };
export const ROUND_LABELS: Record<number, string> = {
  5: '32-avos',
  6: 'Oitavas',
  7: 'Quartas',
  8: 'Semi',
  9: 'Final',
};

export function toGoals(v: string): number | null {
  if (v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) || n < 0 ? null : n;
}

export function deriveWinner(
  home: TeamInfo | null,
  away: TeamInfo | null,
  pick: ScorePick | undefined,
): TeamInfo | null {
  if (!pick || !home || !away) return null;
  const h = toGoals(pick.homeGoals);
  const a = toGoals(pick.awayGoals);
  if (h === null || a === null || h === a) return null;
  return h > a ? home : away;
}

export function getMatchTeams(
  round: number,
  slot: number,
  scorePicks: ScorePicks,
  r32Teams: Map<string, { home: TeamInfo | null; away: TeamInfo | null }>,
): { home: TeamInfo | null; away: TeamInfo | null } {
  if (round === 5) {
    const entry = r32Teams.get(`5-${slot}`);
    return { home: entry?.home ?? null, away: entry?.away ?? null };
  }
  const prevRound = round - 1;
  const homeMatchTeams = getMatchTeams(prevRound, slot * 2, scorePicks, r32Teams);
  const awayMatchTeams = getMatchTeams(prevRound, slot * 2 + 1, scorePicks, r32Teams);
  return {
    home: deriveWinner(homeMatchTeams.home, homeMatchTeams.away, scorePicks[`${prevRound}-${slot * 2}`]),
    away: deriveWinner(awayMatchTeams.home, awayMatchTeams.away, scorePicks[`${prevRound}-${slot * 2 + 1}`]),
  };
}

export function computeAllMatches(
  scorePicks: ScorePicks,
  r32Teams: Map<string, { home: TeamInfo | null; away: TeamInfo | null }>,
): Array<{ round: number; slot: number; home: TeamInfo | null; away: TeamInfo | null }> {
  return ROUNDS.flatMap((round) =>
    Array.from({ length: ROUND_SLOTS[round] }, (_, slot) => {
      const { home, away } = getMatchTeams(round, slot, scorePicks, r32Teams);
      return { round, slot, home, away };
    }),
  );
}
