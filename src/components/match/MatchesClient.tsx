'use client';

import { useState, useEffect } from 'react';
import { DateHeader } from './DateHeader';
import { MatchCard, type MatchCardData } from './MatchCard';
import type { PredictionData } from './PredictionForm';

const POLL_INTERVAL = 5 * 60 * 1000;

interface PredictionEntry {
  home: string;
  away: string;
}

interface Props {
  byDate: { dateKey: string; matches: MatchCardData[] }[];
  predictionMap: Record<string, PredictionData>;
  isAuthenticated: boolean;
}

export function MatchesClient({ byDate, predictionMap, isAuthenticated }: Props) {
  const [values, setValues] = useState<Record<string, PredictionEntry>>(() => {
    const init: Record<string, PredictionEntry> = {};
    const now = new Date();
    for (const { matches } of byDate) {
      for (const match of matches) {
        if (match.status === 'scheduled' && now < new Date(match.kickoff_at)) {
          const pred = predictionMap[match.id];
          if (pred) {
            init[match.id] = { home: String(pred.homeGoals), away: String(pred.awayGoals) };
          }
        }
      }
    }
    return init;
  });

  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; errors: number } | null>(null);

  type LiveScore = { home_goals: number | null; away_goals: number | null; status: MatchCardData['status'] };
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({});

  function anyMatchInProgress() {
    const now = new Date();
    return byDate.some(({ matches }) =>
      matches.some((m) => m.status !== 'finished' && new Date(m.kickoff_at) <= now)
    );
  }

  const [shouldPoll, setShouldPoll] = useState(() =>
    byDate.some(({ matches }) => matches.some((m) => m.status === 'live')) || anyMatchInProgress()
  );

  useEffect(() => {
    if (!shouldPoll) return;

    async function poll() {
      try {
        const res = await fetch('/api/live-matches');
        if (!res.ok) return;
        const { matches, hasLive: stillLive } = await res.json() as {
          matches: { id: string; home_goals: number | null; away_goals: number | null; status: MatchCardData['status'] }[];
          hasLive: boolean;
        };
        const overrides: Record<string, LiveScore> = {};
        for (const m of matches) {
          overrides[m.id] = { home_goals: m.home_goals, away_goals: m.away_goals, status: m.status };
        }
        setLiveScores(overrides);
        // Keep polling while there are live games or matches that should be live by now
        setShouldPoll(stillLive || anyMatchInProgress());
      } catch {
        // silently fail — stale data is fine
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll]);

  function handleChange(matchId: string, side: 'home' | 'away', v: string) {
    setValues((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? { home: '', away: '' }), [side]: v },
    }));
    setDirtyIds((prev) => new Set([...prev, matchId]));
    setResult(null);
  }

  const filledEntries = Object.entries(values).filter(([matchId, v]) => {
    if (!dirtyIds.has(matchId)) return false;
    const h = parseInt(v.home, 10);
    const a = parseInt(v.away, 10);
    return !isNaN(h) && !isNaN(a) && h >= 0 && a >= 0;
  });

  async function handleSaveAll() {
    if (filledEntries.length === 0) return;

    setSaving(true);
    setResult(null);

    let saved = 0;
    let errors = 0;

    await Promise.all(
      filledEntries.map(async ([matchId, v]) => {
        try {
          const res = await fetch('/api/predictions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              match_id: matchId,
              home_goals: parseInt(v.home, 10),
              away_goals: parseInt(v.away, 10),
            }),
          });
          if (res.ok) saved++;
          else errors++;
        } catch {
          errors++;
        }
      })
    );

    setSaving(false);
    setResult({ saved, errors });
    setDirtyIds((prev) => {
      const next = new Set(prev);
      for (const [matchId] of filledEntries) next.delete(matchId);
      return next;
    });
    setTimeout(() => setResult(null), 3000);
  }

  return (
    <div className="space-y-8 pb-32">
      <div className="pt-2">
        <h1
          className="font-display text-4xl tracking-wide"
          style={{ color: 'var(--text-primary)' }}
        >
          JOGOS DA COPA 2026
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Fase de grupos · Faça seus palpites
        </p>
      </div>

      {byDate.map(({ dateKey, matches }) => (
        <section key={dateKey}>
          <DateHeader dateKey={dateKey} />
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={liveScores[match.id] ? { ...match, ...liveScores[match.id] } : match}
                prediction={predictionMap[match.id]}
                isAuthenticated={isAuthenticated}
                homeVal={values[match.id]?.home ?? ''}
                awayVal={values[match.id]?.away ?? ''}
                onHomeChange={(v) => handleChange(match.id, 'home', v)}
                onAwayChange={(v) => handleChange(match.id, 'away', v)}
              />
            ))}
          </div>
        </section>
      ))}

      {isAuthenticated && (
        <div
          className="fixed bottom-20 md:bottom-6 left-0 right-0 z-50 flex flex-col items-center gap-2 py-3 px-4"
          style={{
            background: 'linear-gradient(to top, var(--bg-primary) 80%, transparent)',
          }}
        >
          {result && (
            <span
              className="text-sm font-semibold"
              style={{ color: result.errors > 0 ? '#F87171' : 'var(--brand-green)' }}
            >
              {result.errors > 0
                ? `${result.saved} salvas, ${result.errors} com erro`
                : `✓ ${result.saved} aposta${result.saved !== 1 ? 's' : ''} salva${result.saved !== 1 ? 's' : ''}!`}
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={saving || filledEntries.length === 0}
            className="w-full max-w-sm py-3.5 rounded-2xl font-bold text-base tracking-wide transition-colors"
            style={{
              background: filledEntries.length === 0 ? 'var(--bg-tertiary)' : 'var(--brand-green)',
              color: filledEntries.length === 0 ? 'var(--text-tertiary)' : '#000',
              border: filledEntries.length === 0 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            {saving
              ? 'Salvando...'
              : filledEntries.length === 0
              ? 'Preencha um palpite'
              : `Salvar ${filledEntries.length} aposta${filledEntries.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
