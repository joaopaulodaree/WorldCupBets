'use client';

import { useState, useEffect } from 'react';
import { LeaderboardRow, type LeaderboardEntry } from './LeaderboardRow';

const POLL_INTERVAL = 5 * 60 * 1000;

interface Props {
  initialEntries: LeaderboardEntry[];
  initialHasLive: boolean;
}

export function LeaderboardClient({ initialEntries, initialHasLive }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [hasLive, setHasLive] = useState(initialHasLive);

  useEffect(() => {
    if (!hasLive) return;

    async function poll() {
      try {
        const res = await fetch('/api/leaderboard');
        if (!res.ok) return;
        const data = await res.json() as { entries: LeaderboardEntry[]; hasLive: boolean };
        setEntries(data.entries);
        setHasLive(data.hasLive);
      } catch {
        // silently fail
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLive]);

  if (entries.length === 0) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-2xl mb-3">⚽</p>
        <p className="text-secondary">Nenhum palpite pontuado ainda.</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          O ranking aparecerá após o primeiro jogo ser encerrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasLive && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            color: '#F87171',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"
            style={{ animation: 'pulse 1s ease-in-out infinite' }}
          />
          AO VIVO — pontos provisórios incluídos
        </div>
      )}
      {entries.map((entry) => (
        <LeaderboardRow key={entry.position} entry={entry} />
      ))}
    </div>
  );
}
