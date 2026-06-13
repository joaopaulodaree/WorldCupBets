'use client';

import Image from 'next/image';
import { PredictionForm, type PredictionData } from './PredictionForm';

export interface MatchCardData {
  id: string;
  group_name: string;
  round: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished';
  home_goals: number | null;
  away_goals: number | null;
  home_team: { name: string; code: string; flag_url: string };
  away_team: { name: string; code: string; flag_url: string };
}

function formatKickoffDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}

function formatKickoffTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function LiveBadge() {
  return (
    <span className="live-badge">
      <span className="live-dot-wrap">
        <span className="live-dot" />
        <span className="live-ring" />
        <span className="live-ring live-ring-2" />
        <span className="live-ring live-ring-3" />
      </span>
      AO VIVO
    </span>
  );
}

function TeamSide({
  team,
  align,
}: {
  team: MatchCardData['home_team'];
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 flex-1 min-w-0 ${align === 'right' ? 'items-center' : 'items-center'}`}
    >
      <div
        className="w-12 h-9 rounded overflow-hidden flex-shrink-0"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Image
          src={team.flag_url}
          alt={team.name}
          width={48}
          height={36}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
      <span
        className="text-xs font-semibold text-center leading-tight px-1"
        style={{
          color: 'var(--text-primary)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {team.name}
      </span>
    </div>
  );
}

function ScoreDisplay({
  match,
}: {
  match: MatchCardData;
}) {
  const isScheduled = match.status === 'scheduled';
  const isLive = match.status === 'live';

  if (!isScheduled) {
    return (
      <div className="flex flex-col items-center gap-1 flex-shrink-0 px-2">
        <div className="flex items-center gap-1">
          <span
            className={`font-display text-4xl leading-none${isLive ? ' live-score-digit' : ''}`}
            style={{ color: 'var(--brand-yellow)' }}
          >
            {match.home_goals ?? 0}
          </span>
          <span
            className="font-display text-2xl leading-none"
            style={{ color: isLive ? 'rgba(220,38,38,0.7)' : 'var(--text-tertiary)' }}
          >
            :
          </span>
          <span
            className={`font-display text-4xl leading-none${isLive ? ' live-score-digit' : ''}`}
            style={{ color: 'var(--brand-yellow)' }}
          >
            {match.away_goals ?? 0}
          </span>
        </div>
        {match.status === 'finished' && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)' }}>
            Encerrado
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0 px-3">
      <span
        className="font-display text-2xl leading-none tracking-wider"
        style={{ color: 'var(--text-secondary)' }}
      >
        VS
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: 'var(--brand-green)' }}
      >
        {formatKickoffTime(match.kickoff_at)}
      </span>
      <span
        className="text-xs"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {formatKickoffDate(match.kickoff_at)}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  prediction,
  isAuthenticated,
  homeVal,
  awayVal,
  onHomeChange,
  onAwayChange,
}: {
  match: MatchCardData;
  prediction?: PredictionData;
  isAuthenticated: boolean;
  homeVal: string;
  awayVal: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
}) {
  const isLive = match.status === 'live';

  return (
    <div
      className={`rounded-2xl overflow-hidden${isLive ? ' match-card-live' : ''}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* Top strip */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-tertiary)' }}>
          Grupo {match.group_name} &middot; {match.round}ª Rodada
        </span>
        {match.status === 'live' && <LiveBadge />}
      </div>

      {/* Main scoreboard row */}
      <div className="flex items-center px-4 py-4 gap-2">
        <TeamSide team={match.home_team} align="left" />
        <ScoreDisplay match={match} />
        <TeamSide team={match.away_team} align="right" />
      </div>

      {/* Prediction area */}
      {isAuthenticated && (
        <div
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <PredictionForm
            kickoffAt={match.kickoff_at}
            matchStatus={match.status}
            prediction={prediction}
            homeTeamCode={match.home_team.code}
            awayTeamCode={match.away_team.code}
            homeVal={homeVal}
            awayVal={awayVal}
            onHomeChange={onHomeChange}
            onAwayChange={onAwayChange}
          />
        </div>
      )}
    </div>
  );
}
