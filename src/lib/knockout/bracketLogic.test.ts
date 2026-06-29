// src/lib/knockout/bracketLogic.test.ts
import { describe, it, expect } from 'vitest';
import {
  toGoals,
  deriveWinner,
  getMatchTeams,
  computeAllMatches,
  ROUNDS,
  ROUND_SLOTS,
  type TeamInfo,
  type ScorePicks,
} from './bracketLogic';

const BRA: TeamInfo = { id: 'bra', name: 'Brasil', code: 'BRA', flagUrl: '/bra.png' };
const ARG: TeamInfo = { id: 'arg', name: 'Argentina', code: 'ARG', flagUrl: '/arg.png' };
const ESP: TeamInfo = { id: 'esp', name: 'Espanha', code: 'ESP', flagUrl: '/esp.png' };
const FRA: TeamInfo = { id: 'fra', name: 'França', code: 'FRA', flagUrl: '/fra.png' };

function makeR32Map(entries: Array<[number, TeamInfo | null, TeamInfo | null]>) {
  const map = new Map<string, { home: TeamInfo | null; away: TeamInfo | null }>();
  for (const [slot, home, away] of entries) {
    map.set(`5-${slot}`, { home, away });
  }
  return map;
}

describe('toGoals', () => {
  it('parses valid integer string', () => expect(toGoals('2')).toBe(2));
  it('parses zero', () => expect(toGoals('0')).toBe(0));
  it('returns null for empty string', () => expect(toGoals('')).toBeNull());
  it('returns null for NaN', () => expect(toGoals('abc')).toBeNull());
  it('returns null for negative', () => expect(toGoals('-1')).toBeNull());
});

describe('deriveWinner', () => {
  it('returns home when home goals > away goals', () => {
    expect(deriveWinner(BRA, ARG, { homeGoals: '2', awayGoals: '1' })).toBe(BRA);
  });
  it('returns away when away goals > home goals', () => {
    expect(deriveWinner(BRA, ARG, { homeGoals: '0', awayGoals: '1' })).toBe(ARG);
  });
  it('returns null for draw', () => {
    expect(deriveWinner(BRA, ARG, { homeGoals: '1', awayGoals: '1' })).toBeNull();
  });
  it('returns null when pick is undefined', () => {
    expect(deriveWinner(BRA, ARG, undefined)).toBeNull();
  });
  it('returns null when home team is null', () => {
    expect(deriveWinner(null, ARG, { homeGoals: '2', awayGoals: '1' })).toBeNull();
  });
  it('returns null when away team is null', () => {
    expect(deriveWinner(BRA, null, { homeGoals: '2', awayGoals: '1' })).toBeNull();
  });
});

describe('getMatchTeams', () => {
  const r32 = makeR32Map([[0, BRA, ARG], [1, ESP, FRA]]);

  it('returns DB teams for R32 (round 5)', () => {
    const result = getMatchTeams(5, 0, {}, r32);
    expect(result).toEqual({ home: BRA, away: ARG });
  });

  it('returns null teams for R32 slot with no entry', () => {
    const result = getMatchTeams(5, 99, {}, r32);
    expect(result).toEqual({ home: null, away: null });
  });

  it('derives R16 teams from R32 winners', () => {
    const picks: ScorePicks = {
      '5-0': { homeGoals: '2', awayGoals: '1' }, // BRA wins
      '5-1': { homeGoals: '0', awayGoals: '1' }, // FRA wins
    };
    const result = getMatchTeams(6, 0, picks, r32);
    expect(result).toEqual({ home: BRA, away: FRA });
  });

  it('returns null home when R32 slot 0 has no pick', () => {
    const picks: ScorePicks = {
      '5-1': { homeGoals: '0', awayGoals: '1' }, // FRA wins, slot 0 missing
    };
    const result = getMatchTeams(6, 0, picks, r32);
    expect(result.home).toBeNull();
    expect(result.away).toBe(FRA);
  });

  it('derives QF teams from R16 winners', () => {
    // R32: slot 0 BRA vs ARG, slot 1 ESP vs FRA, slot 2 BRA vs ARG, slot 3 ESP vs FRA
    const r32ext = makeR32Map([[0, BRA, ARG], [1, ESP, FRA], [2, BRA, ARG], [3, ESP, FRA]]);
    const picks: ScorePicks = {
      '5-0': { homeGoals: '2', awayGoals: '0' }, // BRA
      '5-1': { homeGoals: '0', awayGoals: '1' }, // FRA
      '5-2': { homeGoals: '1', awayGoals: '0' }, // BRA
      '5-3': { homeGoals: '2', awayGoals: '1' }, // ESP
      '6-0': { homeGoals: '3', awayGoals: '1' }, // BRA beats FRA → QF home
      '6-1': { homeGoals: '0', awayGoals: '2' }, // ESP beats BRA → QF away
    };
    const result = getMatchTeams(7, 0, picks, r32ext);
    expect(result).toEqual({ home: BRA, away: ESP });
  });
});

describe('computeAllMatches', () => {
  it('returns 31 entries for ROUNDS × ROUND_SLOTS', () => {
    const r32 = makeR32Map(
      Array.from({ length: 16 }, (_, i) => [i, BRA, ARG] as [number, TeamInfo, TeamInfo])
    );
    const result = computeAllMatches({}, r32);
    expect(result).toHaveLength(31);
    expect(result.filter(m => m.round === 5)).toHaveLength(16);
    expect(result.filter(m => m.round === 6)).toHaveLength(8);
  });
});

describe('ROUNDS and ROUND_SLOTS', () => {
  it('ROUNDS has 5 entries', () => expect(ROUNDS).toHaveLength(5));
  it('total slots sum to 31', () => {
    const total = ROUNDS.reduce((sum, r) => sum + ROUND_SLOTS[r], 0);
    expect(total).toBe(31);
  });
});
