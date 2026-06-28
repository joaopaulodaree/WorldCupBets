'use client';

import Image from 'next/image';

export interface KnockoutMatchWithTeams {
  id: string;
  round: number;
  slot: number;
  kickoffAt: string | null;
  status: 'tbd' | 'scheduled' | 'live' | 'finished';
  homeTeam: { id: string; name: string; code: string; flagUrl: string } | null;
  awayTeam: { id: string; name: string; code: string; flagUrl: string } | null;
  winnerTeamId: string | null;
}

interface Props {
  match: KnockoutMatchWithTeams;
  pick: string | null;
  onPick: (teamId: string) => void;
  locked: boolean;
}

function TeamSlot({
  team,
  selected,
  isWinner,
  isLoser,
  onClick,
  disabled,
}: {
  team: { id: string; name: string; code: string; flagUrl: string } | null;
  selected: boolean;
  isWinner: boolean;
  isLoser: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  if (!team) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl opacity-40"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        <div className="w-6 h-6 rounded bg-gray-700 flex-shrink-0" />
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>A definir</span>
      </div>
    );
  }

  let borderColor = 'var(--border-color)';
  let bg = 'var(--bg-card)';
  let opacity = '';

  if (isWinner) { borderColor = '#22c55e'; bg = 'rgba(34,197,94,0.08)'; }
  else if (isLoser) { borderColor = 'var(--border-color)'; bg = 'var(--bg-secondary)'; opacity = 'opacity-40'; }
  else if (selected) { borderColor = 'var(--brand-green)'; bg = 'rgba(34, 197, 94, 0.06)'; }

  return (
    <button
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl w-full text-left transition-all ${opacity} ${!disabled ? 'hover:opacity-90 active:scale-[0.98]' : ''}`}
      style={{ background: bg, border: `1px solid ${borderColor}`, boxShadow: selected && !isWinner ? '0 0 8px rgba(34,197,94,0.3)' : undefined }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {team.flagUrl ? (
        <Image src={team.flagUrl} alt={team.name} width={24} height={16} className="rounded-sm flex-shrink-0 object-cover" style={{ width: 24, height: 16 }} />
      ) : (
        <div className="w-6 h-4 rounded bg-gray-600 flex-shrink-0" />
      )}
      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {team.name}
      </span>
      {isWinner && <span className="ml-auto text-green-400 text-xs flex-shrink-0">✓</span>}
    </button>
  );
}

export function BracketCard({ match, pick, onPick, locked }: Props) {
  const hasResult = match.winnerTeamId !== null;

  return (
    <div
      className="rounded-2xl p-3 space-y-1.5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <TeamSlot
        team={match.homeTeam}
        selected={pick === match.homeTeam?.id}
        isWinner={hasResult && match.winnerTeamId === match.homeTeam?.id}
        isLoser={hasResult && match.winnerTeamId !== match.homeTeam?.id && match.homeTeam !== null}
        onClick={() => match.homeTeam && onPick(match.homeTeam.id)}
        disabled={locked || !match.homeTeam}
      />
      <div className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>vs</div>
      <TeamSlot
        team={match.awayTeam}
        selected={pick === match.awayTeam?.id}
        isWinner={hasResult && match.winnerTeamId === match.awayTeam?.id}
        isLoser={hasResult && match.winnerTeamId !== match.awayTeam?.id && match.awayTeam !== null}
        onClick={() => match.awayTeam && onPick(match.awayTeam.id)}
        disabled={locked || !match.awayTeam}
      />
    </div>
  );
}
