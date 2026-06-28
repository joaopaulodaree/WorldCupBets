import { describe, test, expect } from 'vitest';
import { buildLiveStandings, sortStandings, type GroupMatchInfo } from './standings';

const makeMatch = (
  id: string,
  homeId: string, homeName: string,
  awayId: string, awayName: string,
  homeGoals: number | null,
  awayGoals: number | null,
  status: 'scheduled' | 'live' | 'finished' = 'finished'
): GroupMatchInfo => ({
  id,
  kickoff_at: '2026-06-01T00:00:00Z',
  status,
  homeTeam: { id: homeId, name: homeName, code: 'TST', flag_url: '' },
  awayTeam: { id: awayId, name: awayName, code: 'TST', flag_url: '' },
  homeGoals,
  awayGoals,
});

describe('buildLiveStandings', () => {
  test('empty matches returns empty array', () => {
    expect(buildLiveStandings([], new Map())).toHaveLength(0);
  });

  test('scheduled match with null goals does not affect standings', () => {
    const match = makeMatch('m1', 't1', 'Brazil', 't2', 'Argentina', null, null, 'scheduled');
    const result = buildLiveStandings([match], new Map());
    const brazil = result.find(s => s.teamId === 't1')!;
    expect(brazil.played).toBe(0);
    expect(brazil.points).toBe(0);
  });

  test('home win: 3 pts to home, 0 to away', () => {
    const match = makeMatch('m1', 't1', 'Brazil', 't2', 'Argentina', 3, 0);
    const result = buildLiveStandings([match], new Map());
    expect(result.find(s => s.teamId === 't1')!.points).toBe(3);
    expect(result.find(s => s.teamId === 't2')!.points).toBe(0);
  });

  test('draw: 1 pt each', () => {
    const match = makeMatch('m1', 't1', 'Brazil', 't2', 'Argentina', 1, 1);
    const result = buildLiveStandings([match], new Map());
    expect(result.find(s => s.teamId === 't1')!.points).toBe(1);
    expect(result.find(s => s.teamId === 't2')!.points).toBe(1);
  });

  test('override replaces match result', () => {
    const match = makeMatch('m1', 't1', 'Brazil', 't2', 'Argentina', 1, 0);
    const overrides = new Map([['m1', { home_goals: 0, away_goals: 2, status: 'finished' as const }]]);
    const result = buildLiveStandings([match], overrides);
    expect(result.find(s => s.teamId === 't2')!.points).toBe(3);
  });
});

describe('sortStandings', () => {
  test('sorts by points descending', () => {
    const s = [
      { teamId: 'a', name: 'A', code: 'AAA', flag_url: '', played: 1, wins: 0, draws: 1, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 1 },
      { teamId: 'b', name: 'B', code: 'BBB', flag_url: '', played: 1, wins: 1, draws: 0, losses: 0, goalsFor: 1, goalsAgainst: 0, points: 3 },
    ];
    expect(sortStandings(s)[0].teamId).toBe('b');
  });

  test('tie-breaks by goal difference', () => {
    const s = [
      { teamId: 'a', name: 'A', code: 'AAA', flag_url: '', played: 1, wins: 1, draws: 0, losses: 0, goalsFor: 1, goalsAgainst: 0, points: 3 },
      { teamId: 'b', name: 'B', code: 'BBB', flag_url: '', played: 1, wins: 1, draws: 0, losses: 0, goalsFor: 3, goalsAgainst: 0, points: 3 },
    ];
    expect(sortStandings(s)[0].teamId).toBe('b');
  });
});
