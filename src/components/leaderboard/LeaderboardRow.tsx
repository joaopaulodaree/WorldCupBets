export type LeaderboardEntry = {
  position: number;
  name: string;
  points: number;
  jogos_pts: number;
  grupo_pts: number;
  bracket_pts: number;
  delta: number | null;
  isCurrentUser: boolean;
};

function PositionBadge({ position }: { position: number }) {
  const medals: Record<number, { emoji: string }> = {
    1: { emoji: '🥇' },
    2: { emoji: '🥈' },
    3: { emoji: '🥉' },
  };
  const medal = medals[position];
  if (medal) {
    return <span className="text-xl leading-none">{medal.emoji}</span>;
  }
  return (
    <span
      className="text-sm font-bold tabular-nums w-6 text-center"
      style={{ color: 'var(--text-tertiary)' }}
    >
      {position}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        —
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="text-xs font-semibold" style={{ color: 'var(--brand-green)' }}>
        ↑{delta}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>
      ↓{Math.abs(delta)}
    </span>
  );
}

function PtsPill({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded-md tabular-nums"
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
    >
      {label} {value}
    </span>
  );
}

export function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{
        background: 'var(--bg-card)',
        border: entry.isCurrentUser
          ? '1px solid var(--brand-green)'
          : '1px solid var(--border-color)',
        boxShadow: entry.isCurrentUser ? 'var(--glow-green)' : undefined,
      }}
    >
      <div className="w-8 flex items-center justify-center flex-shrink-0">
        <PositionBadge position={entry.position} />
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
          {entry.name}
          {entry.isCurrentUser && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--brand-green)' }}>
              (você)
            </span>
          )}
        </span>
        {(entry.grupo_pts > 0 || entry.bracket_pts > 0) && (
          <div className="flex gap-1 mt-0.5 flex-wrap">
            <PtsPill label="Jogos" value={entry.jogos_pts} />
            <PtsPill label="Grupo" value={entry.grupo_pts} />
            <PtsPill label="Bracket" value={entry.bracket_pts} />
          </div>
        )}
      </div>

      <span
        className="font-display text-lg tabular-nums flex-shrink-0"
        style={{ color: 'var(--brand-yellow)' }}
      >
        {entry.points}
        <span className="text-xs font-sans ml-0.5" style={{ color: 'var(--text-tertiary)' }}>
          pts
        </span>
      </span>

      <div className="w-8 text-right flex-shrink-0">
        <DeltaBadge delta={entry.delta} />
      </div>
    </div>
  );
}
