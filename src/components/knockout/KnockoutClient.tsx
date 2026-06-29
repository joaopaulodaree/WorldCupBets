'use client';

import { useState, useEffect, useCallback } from 'react';
import { BracketScoreCard } from './BracketScoreCard';
import { RoundTab } from './RoundTab';
import {
  computeAllMatches,
  toGoals,
  ROUNDS,
  ROUND_LABELS,
  type ScorePicks,
  type TeamInfo,
} from '@/lib/knockout/bracketLogic';

export type BracketState =
  | 'locked_pending_groups'
  | 'available_for_picks'
  | 'picks_locked'
  | 'results_revealing'
  | 'completed';

export interface KnockoutMatchWithTeams {
  id: string;
  round: number;
  slot: number;
  kickoffAt: string | null;
  status: 'tbd' | 'scheduled' | 'live' | 'finished';
  homeTeam: TeamInfo | null;
  awayTeam: TeamInfo | null;
  winnerTeamId: string | null;
}

interface Props {
  matches: KnockoutMatchWithTeams[];
  existingScorePicks: Record<string, { homeGoals: number | null; awayGoals: number | null }>;
  bracketState: BracketState;
  userId: string;
}

function draftKey(userId: string) {
  return `mata-mata-draft-${userId}`;
}

function buildR32Map(matches: KnockoutMatchWithTeams[]) {
  const map = new Map<string, { home: TeamInfo | null; away: TeamInfo | null }>();
  for (const m of matches) {
    if (m.round === 5) {
      map.set(`5-${m.slot}`, { home: m.homeTeam, away: m.awayTeam });
    }
  }
  return map;
}

export function KnockoutClient({ matches, existingScorePicks, bracketState, userId }: Props) {
  const locked = bracketState !== 'available_for_picks';

  const r32TeamsMap = buildR32Map(matches);

  const actualWinnerMap = new Map<string, string>(
    matches
      .filter((m) => m.winnerTeamId !== null)
      .map((m) => [`${m.round}-${m.slot}`, m.winnerTeamId!]),
  );

  // Matches that have started or finished are locked individually regardless of bracket state
  const startedMatchKeys = new Set(
    matches
      .filter((m) => m.status === 'live' || m.status === 'finished')
      .map((m) => `${m.round}-${m.slot}`),
  );

  const [activeRound, setActiveRound] = useState(5);
  const [scorePicks, setScorePicks] = useState<ScorePicks>(() => {
    // Initialize from existing submitted picks
    const base: ScorePicks = {};
    for (const [key, pick] of Object.entries(existingScorePicks)) {
      if (pick.homeGoals !== null && pick.awayGoals !== null) {
        base[key] = { homeGoals: String(pick.homeGoals), awayGoals: String(pick.awayGoals) };
      }
    }
    // Merge localStorage draft if bracket is open
    if (typeof window !== 'undefined' && bracketState === 'available_for_picks') {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey(userId)) ?? '{}') as ScorePicks;
        Object.assign(base, draft);
      } catch {
        // ignore
      }
    }
    return base;
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Object.keys(existingScorePicks).length > 0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Persist draft
  useEffect(() => {
    if (bracketState !== 'available_for_picks') return;
    try {
      localStorage.setItem(draftKey(userId), JSON.stringify(scorePicks));
    } catch {
      // ignore
    }
  }, [scorePicks, userId, bracketState]);

  const handleGoalsChange = useCallback(
    (round: number, slot: number, side: 'home' | 'away', value: string) => {
      const key = `${round}-${slot}`;
      setScorePicks((prev) => ({
        ...prev,
        [key]: {
          homeGoals: side === 'home' ? value : (prev[key]?.homeGoals ?? ''),
          awayGoals: side === 'away' ? value : (prev[key]?.awayGoals ?? ''),
        },
      }));
    },
    [],
  );

  // Derived
  const allMatches = computeAllMatches(scorePicks, r32TeamsMap);
  const matchesWithTeams = allMatches.filter((m) => m.home && m.away);

  const validPickCount = matchesWithTeams.filter(({ round, slot }) => {
    const pick = scorePicks[`${round}-${slot}`];
    const h = toGoals(pick?.homeGoals);
    const a = toGoals(pick?.awayGoals);
    return h !== null && a !== null && h !== a;
  }).length;

  const allPicksDone = matchesWithTeams.length > 0 && validPickCount === matchesWithTeams.length;

  const roundPickCount = (round: number) =>
    allMatches
      .filter((m) => m.round === round && m.home && m.away)
      .filter(({ slot }) => {
        const pick = scorePicks[`${round}-${slot}`];
        const h = toGoals(pick?.homeGoals);
        const a = toGoals(pick?.awayGoals);
        return h !== null && a !== null && h !== a;
      }).length;

  const roundTotal = (round: number) =>
    allMatches.filter((m) => m.round === round && m.home && m.away).length;

  async function handleSubmit() {
    if (!allPicksDone || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const pickList = matchesWithTeams
      .map(({ round, slot, home, away }) => {
        const pick = scorePicks[`${round}-${slot}`];
        const h = toGoals(pick?.homeGoals);
        const a = toGoals(pick?.awayGoals);
        if (h === null || a === null || h === a) return null;
        const winner = h > a ? home! : away!;
        return { round, slot, teamId: winner.id, homeGoals: h, awayGoals: a };
      })
      .filter(Boolean);

    try {
      const res = await fetch('/api/bracket/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: pickList }),
      });

      if (res.status === 409) {
        setSubmitted(true);
        try { localStorage.removeItem(draftKey(userId)); } catch { /* ignore */ }
        return;
      }

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSubmitError(body.error ?? 'Erro ao enviar bracket');
        return;
      }

      setSubmitted(true);
      try { localStorage.removeItem(draftKey(userId)); } catch { /* ignore */ }
    } catch {
      setSubmitError('Erro de rede. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (bracketState === 'locked_pending_groups') {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-4xl mb-4">🔒</p>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Mata-mata bloqueado
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          O bracket abre quando todos os jogos da fase de grupos terminarem
          e o chaveamento das Oitavas for definido.
        </p>
      </div>
    );
  }

  const activeMatches = allMatches.filter((m) => m.round === activeRound);

  return (
    <div className="space-y-4">
      {/* Round tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ROUNDS.map((round) => (
          <RoundTab
            key={round}
            label={ROUND_LABELS[round]}
            pickCount={roundPickCount(round)}
            total={roundTotal(round)}
            active={activeRound === round}
            onClick={() => setActiveRound(round)}
          />
        ))}
      </div>

      {/* Match cards for active round */}
      <div className="space-y-3">
        {activeMatches.map(({ round, slot, home, away }) => {
          const key = `${round}-${slot}`;
          const pick = scorePicks[key];
          return (
            <BracketScoreCard
              key={key}
              homeTeam={home}
              awayTeam={away}
              homeGoals={pick?.homeGoals ?? ''}
              awayGoals={pick?.awayGoals ?? ''}
              onHomeChange={(v) => handleGoalsChange(round, slot, 'home', v)}
              onAwayChange={(v) => handleGoalsChange(round, slot, 'away', v)}
              locked={locked || submitted || startedMatchKeys.has(key)}
              actualWinnerId={actualWinnerMap.get(key) ?? null}
            />
          );
        })}
      </div>

      {/* Submit */}
      {bracketState === 'available_for_picks' && !submitted && (
        <div className="sticky bottom-20 pt-2">
          {submitError && (
            <p className="text-center text-sm mb-2" style={{ color: '#EF4444' }}>{submitError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!allPicksDone || submitting}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all"
            style={{
              background: allPicksDone ? 'var(--brand-green)' : 'var(--bg-secondary)',
              color: allPicksDone ? '#000' : 'var(--text-tertiary)',
              cursor: allPicksDone ? 'pointer' : 'default',
            }}
          >
            {submitting
              ? 'Enviando…'
              : allPicksDone
              ? `Confirmar bracket (${validPickCount}/${matchesWithTeams.length})`
              : `Preencha todos os palpites (${validPickCount}/${matchesWithTeams.length})`}
          </button>
        </div>
      )}

      {submitted && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--brand-green)' }}>
            ✓ Bracket confirmado!
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Acompanhe os resultados aqui conforme os jogos acontecem.
          </p>
        </div>
      )}
    </div>
  );
}
