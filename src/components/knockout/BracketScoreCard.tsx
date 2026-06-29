// src/components/knockout/BracketScoreCard.tsx
'use client';

import Image from 'next/image';
import type { TeamInfo } from '@/lib/knockout/bracketLogic';
import { toGoals } from '@/lib/knockout/bracketLogic';

interface Props {
  homeTeam: TeamInfo | null;
  awayTeam: TeamInfo | null;
  homeGoals: string;
  awayGoals: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
  locked: boolean;
  actualWinnerId?: string | null;
}

function ScoreInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="–"
      aria-label={label}
      className="w-11 h-11 text-center font-display text-2xl rounded-xl focus:outline-none flex-shrink-0"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1.5px solid var(--border-bright)',
        color: 'var(--text-primary)',
        caretColor: 'var(--brand-green)',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--brand-green)';
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,196,74,0.2)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-bright)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

function TeamRow({
  team,
  goals,
  locked,
  onGoalsChange,
  isWinner,
  isLoser,
  borderTop,
}: {
  team: TeamInfo | null;
  goals: string;
  locked: boolean;
  onGoalsChange: (v: string) => void;
  isWinner: boolean;
  isLoser: boolean;
  borderTop?: boolean;
}) {
  if (!team) {
    return (
      <div
        className="flex items-center gap-2 py-2 opacity-40"
        style={borderTop ? { borderTop: '1px solid var(--border-color)' } : undefined}
      >
        <div className="w-6 h-4 rounded bg-gray-700 flex-shrink-0" />
        <span className="text-sm flex-1" style={{ color: 'var(--text-tertiary)' }}>
          A definir
        </span>
        {locked ? (
          <span className="w-8 text-right text-lg font-display" style={{ color: 'var(--text-tertiary)' }}>–</span>
        ) : (
          <div className="w-11 h-11" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 py-2 transition-opacity ${isLoser ? 'opacity-40' : ''}`}
      style={borderTop ? { borderTop: '1px solid var(--border-color)' } : undefined}
    >
      <Image
        src={team.flagUrl}
        alt={team.name}
        width={24}
        height={16}
        className="rounded-sm flex-shrink-0 object-cover"
        style={{ width: 24, height: 16 }}
        unoptimized
      />
      <span
        className="text-sm font-medium truncate flex-1"
        style={{ color: isWinner ? 'var(--brand-green)' : 'var(--text-primary)' }}
      >
        {team.name}
      </span>
      {isWinner && !locked && (
        <span className="text-green-400 text-xs flex-shrink-0 mr-1">▲</span>
      )}
      {locked ? (
        <span
          className="w-8 text-right text-lg font-display flex-shrink-0"
          style={{ color: isWinner ? 'var(--brand-green)' : 'var(--text-tertiary)' }}
        >
          {goals !== '' ? goals : '–'}
        </span>
      ) : (
        <ScoreInput value={goals} onChange={onGoalsChange} label={`Gols ${team.code}`} />
      )}
    </div>
  );
}

export function BracketScoreCard({
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
  onHomeChange,
  onAwayChange,
  locked,
  actualWinnerId,
}: Props) {
  const h = toGoals(homeGoals);
  const a = toGoals(awayGoals);
  const predictedWinnerId =
    h !== null && a !== null && h !== a
      ? h > a
        ? homeTeam?.id
        : awayTeam?.id
      : undefined;

  const effectiveWinnerId = actualWinnerId ?? predictedWinnerId;

  const homeIsWinner = !!effectiveWinnerId && effectiveWinnerId === homeTeam?.id;
  const awayIsWinner = !!effectiveWinnerId && effectiveWinnerId === awayTeam?.id;
  const homeIsLoser = !!effectiveWinnerId && !homeIsWinner && homeTeam !== null;
  const awayIsLoser = !!effectiveWinnerId && !awayIsWinner && awayTeam !== null;

  return (
    <div
      className="rounded-2xl px-3"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      <TeamRow
        team={homeTeam}
        goals={homeGoals}
        locked={locked}
        onGoalsChange={onHomeChange}
        isWinner={homeIsWinner}
        isLoser={homeIsLoser}
      />
      <TeamRow
        team={awayTeam}
        goals={awayGoals}
        locked={locked}
        onGoalsChange={onAwayChange}
        isWinner={awayIsWinner}
        isLoser={awayIsLoser}
        borderTop
      />
    </div>
  );
}
