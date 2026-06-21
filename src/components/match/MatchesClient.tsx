'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DateHeader } from './DateHeader';
import { MatchCard, type MatchCardData } from './MatchCard';
import type { PredictionData } from './PredictionForm';

const POLL_INTERVAL_LIVE = 30_000;
const POLL_INTERVAL_IDLE = 5 * 60 * 1000;

interface PredictionEntry {
  home: string;
  away: string;
}

interface Props {
  byDate: { dateKey: string; matches: MatchCardData[] }[];
  predictionMap: Record<string, PredictionData>;
  isAuthenticated: boolean;
  todayKey: string;
}

export function MatchesClient({ byDate, predictionMap, isAuthenticated, todayKey }: Props) {
  const dateKeys = byDate.map((d) => d.dateKey);
  const lastDateKey = dateKeys[dateKeys.length - 1] ?? '';
  // When today is past the tournament, show all sections open
  const tournamentOver = todayKey > lastDateKey;

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

  // Past days collapsed by default (unless tournament is over)
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(() => {
    if (tournamentOver) return new Set();
    return new Set(dateKeys.filter((k) => k < todayKey));
  });

  // Refs for each date section (for scroll-to-today)
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const setSectionRef = useCallback((dateKey: string, el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(dateKey, el);
    else sectionRefs.current.delete(dateKey);
  }, []);

  // FAB visibility via IntersectionObserver
  const [showFab, setShowFab] = useState(false);
  const todaySectionRef = useRef<HTMLElement | null>(null);

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

  // Scroll to today's section on mount
  useEffect(() => {
    // Find today's section, or the next future day if today has no matches
    const targetKey = dateKeys.find((k) => k >= todayKey);
    if (!targetKey) return;
    const el = sectionRefs.current.get(targetKey);
    if (!el) return;
    // Small delay so the page has fully painted before scrolling
    const id = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IntersectionObserver for FAB — show when today's section is <10% visible
  useEffect(() => {
    const el = todaySectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFab(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function scrollToToday() {
    const targetKey = dateKeys.find((k) => k >= todayKey);
    if (!targetKey) return;
    const el = sectionRefs.current.get(targetKey);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleCollapse(dateKey: string) {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch('/api/live-matches');
        if (!res.ok || cancelled) return;
        const { matches, hasLive: stillLive } = await res.json() as {
          matches: { id: string; home_goals: number | null; away_goals: number | null; status: MatchCardData['status'] }[];
          hasLive: boolean;
        };
        const overrides: Record<string, LiveScore> = {};
        for (const m of matches) {
          overrides[m.id] = { home_goals: m.home_goals, away_goals: m.away_goals, status: m.status };
        }
        setLiveScores(overrides);

        const keepPolling = stillLive || anyMatchInProgress();
        setShouldPoll(keepPolling);
        if (keepPolling && !cancelled) {
          timeoutId = setTimeout(poll, stillLive ? POLL_INTERVAL_LIVE : POLL_INTERVAL_IDLE);
        }
      } catch {
        // silently fail — retry at idle interval
        if (!cancelled) {
          timeoutId = setTimeout(poll, POLL_INTERVAL_IDLE);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
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

      {byDate.map(({ dateKey, matches }) => {
        const isToday = dateKey === todayKey;
        const isPast = !tournamentOver && dateKey < todayKey;
        const collapsed = collapsedDates.has(dateKey);

        return (
          <section
            key={dateKey}
            id={`date-${dateKey}`}
            ref={(el) => {
              setSectionRef(dateKey, el);
              if (isToday) todaySectionRef.current = el;
            }}
          >
            <DateHeader
              dateKey={dateKey}
              isToday={isToday}
              isPast={isPast}
              collapsed={collapsed}
              matchCount={matches.length}
              onToggle={isPast ? () => toggleCollapse(dateKey) : undefined}
            />
            {!collapsed && (
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
            )}
          </section>
        );
      })}

      {showFab && (
        <button
          onClick={scrollToToday}
          className="fixed bottom-36 md:bottom-24 right-4 z-50 flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-sm shadow-lg transition-opacity"
          style={{ background: 'var(--brand-green)', color: '#000' }}
          aria-label="Ir para hoje"
        >
          <span>↓</span>
          <span>Hoje</span>
        </button>
      )}

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
