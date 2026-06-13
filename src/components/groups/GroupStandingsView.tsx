'use client';

import Image from 'next/image';
import { useState } from 'react';

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

export interface GroupData {
  name: string;
  realStandings: TeamStanding[];
  predictedStandings: TeamStanding[];
  finishedCount: number;
  predictedCount: number;
}

function sortStandings(standings: TeamStanding[]): TeamStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

function StandingsTable({ standings }: { standings: TeamStanding[] }) {
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
          return (
            <tr
              key={team.teamId}
              className={`border-b border-primary/30 last:border-0 transition-colors hover:bg-primary/30 ${
                advances ? 'text-primary' : 'text-secondary'
              }`}
            >
              <td className="py-2.5 relative pl-2">
                {advances && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-green rounded-full" />
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
              <td className="py-2.5 text-center font-bold text-brand-yellow">{team.points}</td>
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-green mb-2">Tabela de Grupos</h1>
        <p className="text-secondary">Tabela real vs seus palpites</p>
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
          const standings =
            activeTab === 'real' ? group.realStandings : group.predictedStandings;
          const count = activeTab === 'real' ? group.finishedCount : group.predictedCount;
          const empty =
            activeTab === 'real'
              ? standings.length === 0
              : standings.length === 0 && isAuthenticated;

          return (
            <div
              key={group.name}
              className="bg-secondary border border-primary rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-primary">
                <h2 className="font-bold text-sm text-primary">Grupo {group.name}</h2>
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
                  <StandingsTable standings={standings} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-tertiary text-center pb-4">
        Top 2 de cada grupo avançam para as oitavas de final
      </p>
    </div>
  );
}
