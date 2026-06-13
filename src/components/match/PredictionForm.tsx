'use client';

export interface PredictionData {
  homeGoals: number;
  awayGoals: number;
  points: number | null;
}

interface Props {
  kickoffAt: string;
  matchStatus: 'scheduled' | 'live' | 'finished';
  prediction?: PredictionData;
  homeTeamCode: string;
  awayTeamCode: string;
  homeVal: string;
  awayVal: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
}

function ScoreInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="–"
      aria-label={label}
      className="w-11 h-11 text-center font-display text-2xl rounded-xl focus:outline-none"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1.5px solid var(--border-bright)',
        color: 'var(--text-primary)',
        caretColor: 'var(--brand-green)',
      }}
      onFocus={(e) => {
        (e.target as HTMLInputElement).style.borderColor = 'var(--brand-green)';
        (e.target as HTMLInputElement).style.boxShadow = '0 0 0 2px rgba(0, 196, 74, 0.2)';
      }}
      onBlur={(e) => {
        (e.target as HTMLInputElement).style.borderColor = 'var(--border-bright)';
        (e.target as HTMLInputElement).style.boxShadow = 'none';
      }}
    />
  );
}

function PointsBadge({ points }: { points: number | null }) {
  if (points === null) return null;

  const config =
    points === 3
      ? { bg: 'rgba(0, 196, 74, 0.15)', color: 'var(--brand-green)', border: 'rgba(0, 196, 74, 0.3)', label: '+3 pts' }
      : points === 1
      ? { bg: 'rgba(255, 214, 0, 0.15)', color: 'var(--brand-yellow)', border: 'rgba(255, 214, 0, 0.3)', label: '+1 pt' }
      : { bg: 'rgba(220, 38, 38, 0.1)', color: '#F87171', border: 'rgba(220, 38, 38, 0.2)', label: '0 pts' };

  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full"
      style={{
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

export function PredictionForm({
  kickoffAt,
  matchStatus,
  prediction,
  homeTeamCode,
  awayTeamCode,
  homeVal,
  awayVal,
  onHomeChange,
  onAwayChange,
}: Props) {
  const isLocked = matchStatus !== 'scheduled' || new Date() >= new Date(kickoffAt);

  if (isLocked) {
    return (
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <LockIcon />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {prediction !== undefined
              ? `Palpite: ${prediction.homeGoals}–${prediction.awayGoals}`
              : 'Sem palpite'}
          </span>
        </div>
        {prediction && <PointsBadge points={prediction.points} />}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        Seu palpite
      </span>

      <div className="flex items-center gap-2 justify-center">
        <span
          className="text-xs font-bold w-10 text-right truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {homeTeamCode}
        </span>
        <ScoreInput value={homeVal} onChange={onHomeChange} label={`Gols ${homeTeamCode}`} />
        <span
          className="font-display text-xl"
          style={{ color: 'var(--text-tertiary)' }}
        >
          –
        </span>
        <ScoreInput value={awayVal} onChange={onAwayChange} label={`Gols ${awayTeamCode}`} />
        <span
          className="text-xs font-bold w-10 truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {awayTeamCode}
        </span>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      className="w-3 h-3 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color: 'var(--text-tertiary)' }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}
