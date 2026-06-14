'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

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

export interface GroupData {
  name: string;
  matches: GroupMatchInfo[];
  realStandings: TeamStanding[];
  predictedStandings: TeamStanding[];
  finishedCount: number;
  predictedCount: number;
}

type LiveOverride = { home_goals: number | null; away_goals: number | null; status: 'live' | 'finished' };

function sortStandings(standings: TeamStanding[]): TeamStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

function buildLiveStandings(
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

const POLL_INTERVAL_LIVE = 30_000;
const POLL_INTERVAL_IDLE = 5 * 60 * 1000;

function getQualifyingThirdIds(allGroupStandings: TeamStanding[][]): Set<string> {
  const thirds: TeamStanding[] = [];
  for (const standings of allGroupStandings) {
    const sorted = sortStandings(standings);
    if (sorted.length >= 3) thirds.push(sorted[2]);
  }
  const sortedThirds = [...thirds].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
  return new Set(sortedThirds.slice(0, 8).map((t) => t.teamId));
}

function StandingsTable({
  standings,
  liveTeamIds,
  qualifyingThirdIds,
}: {
  standings: TeamStanding[];
  liveTeamIds: Set<string>;
  qualifyingThirdIds: Set<string>;
}) {
  const sorted = sortStandings(standings);

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-tertiary border-b border-primary">
          <th className="text-left py-2 pl-2 font-normal w-6">#</th>
          <th className="text-left py-2 pl-1 font-normal">Seleção</th>
          <th className="text-center py-2 w-7 font-normal">J</th>
          <th className="text-center py-2 w-7 font-normal">V</th>
          <th className="text-center py-2 w-7 font-normal">E</th>
          <th className="text-center py-2 w-7 font-normal">D</th>
          <th className="text-center py-2 w-7 font-normal">GP</th>
          <th className="text-center py-2 w-7 font-normal">GC</th>
          <th className="text-center py-2 w-8 font-normal">SG</th>
          <th className="text-center py-2 w-8 font-semibold text-primary">Pts</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((team, i) => {
          const gd = team.goalsFor - team.goalsAgainst;
          const advances = i < 2;
          const qualifyingThird = i === 2 && qualifyingThirdIds.has(team.teamId);
          const isLive = liveTeamIds.has(team.teamId);
          return (
            <tr
              key={team.teamId}
              className={`border-b border-primary/30 last:border-0 transition-colors hover:bg-primary/30 ${
                advances || qualifyingThird ? 'text-primary' : 'text-tertiary'
              }`}
            >
              <td className="py-2.5 relative pl-2">
                {advances && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-green rounded-full" />
                )}
                {qualifyingThird && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-yellow rounded-full" />
                )}
                <span className="text-tertiary">{i + 1}</span>
              </td>
              <td className="py-2.5 pl-1">
                <div className="flex items-center gap-2">
                  <Image
                    src={team.flag_url}
                    alt={team.name}
                    width={22}
                    height={15}
                    className="rounded-sm object-cover flex-shrink-0"
                    unoptimized
                  />
                  <span className="truncate font-medium">{team.name}</span>
                  {isLive && (
                    <span className="live-dot-wrap flex-shrink-0" style={{ width: 7, height: 7 }}>
                      <span className="live-dot" />
                      <span className="live-ring" />
                      <span className="live-ring live-ring-2" />
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2.5 text-center text-tertiary">{team.played}</td>
              <td className="py-2.5 text-center">{team.wins}</td>
              <td className="py-2.5 text-center">{team.draws}</td>
              <td className="py-2.5 text-center">{team.losses}</td>
              <td className="py-2.5 text-center text-tertiary">{team.goalsFor}</td>
              <td className="py-2.5 text-center text-tertiary">{team.goalsAgainst}</td>
              <td className="py-2.5 text-center text-tertiary">
                {gd > 0 ? `+${gd}` : gd}
              </td>
              <td className={`py-2.5 text-center font-bold${isLive ? ' live-score-digit' : ' text-brand-yellow'}`}>
                {team.points}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function GroupStandingsView({
  groups,
  isAuthenticated,
}: {
  groups: GroupData[];
  isAuthenticated: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'real' | 'predicted'>('real');

  const hasLiveInitially = groups.some((g) => g.matches.some((m) => m.status === 'live'));
  const hasStartedMatch = groups.some((g) =>
    g.matches.some((m) => m.status !== 'finished' && new Date(m.kickoff_at) <= new Date())
  );

  const [shouldPoll, setShouldPoll] = useState(hasLiveInitially || hasStartedMatch);
  const [liveOverrides, setLiveOverrides] = useState<Map<string, LiveOverride>>(new Map);

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch('/api/live-matches');
        if (!res.ok || cancelled) return;
        const { matches, hasLive: stillLive } = await res.json() as {
          matches: { id: string; home_goals: number | null; away_goals: number | null; status: 'live' | 'finished' }[];
          hasLive: boolean;
        };

        if (!cancelled) {
          const overrides = new Map<string, LiveOverride>();
          for (const m of matches) {
            overrides.set(m.id, { home_goals: m.home_goals, away_goals: m.away_goals, status: m.status });
          }
          setLiveOverrides(overrides);
          setShouldPoll(stillLive);
          if (!cancelled) {
            timeoutId = setTimeout(poll, stillLive ? POLL_INTERVAL_LIVE : POLL_INTERVAL_IDLE);
          }
        }
      } catch {
        if (!cancelled) timeoutId = setTimeout(poll, POLL_INTERVAL_IDLE);
      }
    }

    poll();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll]);

  // Which team IDs are currently in a live match (from overrides or initial data)
  const liveTeamIds = new Set<string>();
  for (const g of groups) {
    for (const m of g.matches) {
      const override = liveOverrides.get(m.id);
      if ((override?.status ?? m.status) === 'live') {
        liveTeamIds.add(m.homeTeam.id);
        liveTeamIds.add(m.awayTeam.id);
      }
    }
  }

  const hasAnyLive = liveTeamIds.size > 0;

  // Cross-group: which 8 third-place teams are currently qualifying
  const allRealStandings = groups.map((g) =>
    liveOverrides.size > 0 ? buildLiveStandings(g.matches, liveOverrides) : g.realStandings,
  );
  const allPredictedStandings = groups.map((g) => g.predictedStandings);
  const realQualifyingThirds = getQualifyingThirdIds(allRealStandings);
  const predictedQualifyingThirds = getQualifyingThirdIds(allPredictedStandings);
  const qualifyingThirds = activeTab === 'real' ? realQualifyingThirds : predictedQualifyingThirds;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-green mb-2">Tabela de Grupos</h1>
        <p className="text-secondary">
          {hasAnyLive ? (
            <span className="flex items-center justify-center gap-2">
              <span className="live-dot-wrap" style={{ width: 7, height: 7 }}>
                <span className="live-dot" />
                <span className="live-ring" />
                <span className="live-ring live-ring-2" />
              </span>
              Atualização ao vivo · a cada 30s
            </span>
          ) : (
            'Tabela real vs seus palpites'
          )}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-primary overflow-hidden">
        <button
          onClick={() => setActiveTab('real')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'real'
              ? 'bg-brand-green text-black'
              : 'text-secondary hover:text-primary'
          }`}
        >
          Resultado Real
        </button>
        <button
          onClick={() => setActiveTab('predicted')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'predicted'
              ? 'bg-brand-yellow text-black'
              : 'text-secondary hover:text-primary'
          }`}
        >
          Seus Palpites
        </button>
      </div>

      {activeTab === 'predicted' && !isAuthenticated && (
        <div className="bg-secondary border border-primary rounded-xl p-6 text-center">
          <p className="text-secondary">Faça login para ver seus palpites</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => {
          const hasGroupLive = group.matches.some((m) => {
            const override = liveOverrides.get(m.id);
            return (override?.status ?? m.status) === 'live';
          });

          // When there are live overrides, recalculate standings dynamically
          const realStandings = liveOverrides.size > 0
            ? buildLiveStandings(group.matches, liveOverrides)
            : group.realStandings;

          const standings = activeTab === 'real' ? realStandings : group.predictedStandings;
          const count = activeTab === 'real' ? group.finishedCount : group.predictedCount;
          const empty =
            activeTab === 'real'
              ? standings.length === 0
              : standings.length === 0 && isAuthenticated;

          const groupLiveTeamIds = new Set(
            group.matches
              .filter((m) => (liveOverrides.get(m.id)?.status ?? m.status) === 'live')
              .flatMap((m) => [m.homeTeam.id, m.awayTeam.id])
          );

          return (
            <div
              key={group.name}
              className={`border rounded-xl overflow-hidden transition-all${hasGroupLive ? ' match-card-live' : ' bg-secondary border-primary'}`}
              style={hasGroupLive ? { background: 'var(--bg-secondary)' } : undefined}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-primary">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-primary">Grupo {group.name}</h2>
                  {hasGroupLive && (
                    <span className="live-badge" style={{ fontSize: '0.55rem', padding: '2px 7px 2px 5px', gap: 4 }}>
                      <span className="live-dot-wrap" style={{ width: 6, height: 6 }}>
                        <span className="live-dot" />
                        <span className="live-ring" />
                        <span className="live-ring live-ring-2" />
                      </span>
                      AO VIVO
                    </span>
                  )}
                </div>
                <span className="text-xs text-tertiary">{count}/6 jogos</span>
              </div>

              {empty ? (
                <p className="text-xs text-tertiary text-center py-6">
                  {activeTab === 'real'
                    ? 'Nenhum jogo encerrado ainda'
                    : 'Nenhum palpite registrado'}
                </p>
              ) : (
                <div className="px-2 pb-1">
                  <StandingsTable
                    standings={standings}
                    liveTeamIds={activeTab === 'real' ? groupLiveTeamIds : new Set()}
                    qualifyingThirdIds={qualifyingThirds}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pb-4 space-y-2">
        <p className="text-xs text-tertiary text-center font-medium">Legenda de classificação</p>
        <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
          <div className="flex items-center gap-2 text-xs text-secondary">
            <span className="w-2 h-4 bg-brand-green rounded-full flex-shrink-0" />
            <span>1º e 2º lugar — classificados para as oitavas</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-secondary">
            <span className="w-2 h-4 bg-brand-yellow rounded-full flex-shrink-0" />
            <span>3º lugar — entre os 8 melhores terceiros (classificando)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <span className="w-2 h-4 bg-white/10 rounded-full flex-shrink-0" />
            <span>3º/4º lugar fora — eliminado</span>
          </div>
        </div>
        <p className="text-xs text-tertiary text-center pt-1">
          Comparação por pts → saldo → gols. Em caso de empate: fair play e ranking FIFA (não calculados aqui)
        </p>
      </div>
    </div>
  );
}
