'use client';

import { useState } from 'react';
import { DateHeader } from './DateHeader';
import { MatchCard, type MatchCardData } from './MatchCard';
import type { PredictionData } from './PredictionForm';

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
    for (const [matchId, pred] of Object.entries(predictionMap)) {
      init[matchId] = { home: String(pred.homeGoals), away: String(pred.awayGoals) };
    }
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; errors: number } | null>(null);

  function handleChange(matchId: string, side: 'home' | 'away', v: string) {
    setValues((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? { home: '', away: '' }), [side]: v },
    }));
    setResult(null);
  }

  const filledEntries = Object.entries(values).filter(([, v]) => {
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
                match={match}
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
