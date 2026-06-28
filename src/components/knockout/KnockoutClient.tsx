'use client';

import { useState, useEffect, useCallback } from 'react';
import { BracketCard, type KnockoutMatchWithTeams } from './BracketCard';
import { RoundTab } from './RoundTab';

export type BracketState =
  | 'locked_pending_groups'
  | 'available_for_picks'
  | 'picks_locked'
  | 'results_revealing'
  | 'completed';

const ROUND_LABELS: Record<number, string> = {
  5: '32-avos',
  6: 'Oitavas',
  7: 'Quartas',
  8: 'Semi',
  9: 'Final',
};

const ROUND_SLOTS: Record<number, number> = { 5: 16, 6: 8, 7: 4, 8: 2, 9: 1 };
const ROUNDS = [5, 6, 7, 8, 9];

interface Props {
  matches: KnockoutMatchWithTeams[];
  existingPicks: Record<string, string>;
  bracketState: BracketState;
  userId: string;
}

function isMatchLocked(match: KnockoutMatchWithTeams): boolean {
  if (!match.kickoffAt) return false;
  return new Date(match.kickoffAt) <= new Date();
}

function draftKey(userId: string) {
  return `mata-mata-draft-${userId}`;
}

export function KnockoutClient({ matches, existingPicks, bracketState, userId }: Props) {
  const matchesByRound = (round: number) =>
    matches.filter(m => m.round === round).sort((a, b) => a.slot - b.slot);

  const [activeRound, setActiveRound] = useState(() => {
    return ROUNDS.find(r =>
      matches.filter(m => m.round === r).some(m => !isMatchLocked(m))
    ) ?? 5;
  });

  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const base = { ...existingPicks };
    if (typeof window !== 'undefined') {
      try {
        const draft = JSON.parse(
          localStorage.getItem(draftKey(userId)) ?? '{}'
        ) as Record<string, string>;
        if (bracketState === 'available_for_picks') {
          Object.assign(base, draft);
        }
      } catch {
        // ignore parse errors
      }
    }
    return base;
  });

  const [submittedRounds, setSubmittedRounds] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (bracketState !== 'available_for_picks') return;
    try {
      localStorage.setItem(draftKey(userId), JSON.stringify(picks));
    } catch {
      // ignore storage errors
    }
  }, [picks, userId, bracketState]);

  const handlePick = useCallback((round: number, slot: number, teamId: string) => {
    setPicks(prev => ({ ...prev, [`${round}-${slot}`]: teamId }));
    setSubmittedRounds(prev => ({ ...prev, [round]: false }));
  }, []);

  function getUnlockedPicks(round: number) {
    return matchesByRound(round)
      .filter(m => !isMatchLocked(m))
      .map(m => ({ slot: m.slot, teamId: picks[`${round}-${m.slot}`] ?? '' }))
      .filter(p => p.teamId !== '');
  }

  async function handleRoundSubmit(round: number) {
    if (submitting !== null) return;
    const unlockedPicks = getUnlockedPicks(round);
    if (unlockedPicks.length === 0) return;

    setSubmitting(round);
    setSubmitErrors(prev => {
      const n = { ...prev };
      delete n[round];
      return n;
    });

    try {
      const res = await fetch('/api/bracket/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round, picks: unlockedPicks }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setSubmitErrors(prev => ({
          ...prev,
          [round]: body.error ?? 'Erro ao enviar picks',
        }));
        return;
      }

      setSubmittedRounds(prev => ({ ...prev, [round]: true }));
      clearDraftRound(round);
    } catch {
      setSubmitErrors(prev => ({
        ...prev,
        [round]: 'Erro de rede. Tente novamente.',
      }));
    } finally {
      setSubmitting(null);
    }
  }

  function clearDraftRound(round: number) {
    try {
      const draft = JSON.parse(
        localStorage.getItem(draftKey(userId)) ?? '{}'
      ) as Record<string, string>;
      for (const m of matchesByRound(round)) {
        delete draft[`${round}-${m.slot}`];
      }
      localStorage.setItem(draftKey(userId), JSON.stringify(draft));
    } catch {
      // ignore storage errors
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

  const canInteract = bracketState === 'available_for_picks';
  const activeMatches = matchesByRound(activeRound);
  const unlockedPicks = getUnlockedPicks(activeRound);
  const isRoundSubmitted = submittedRounds[activeRound] ?? false;
  const showSubmitButton = canInteract && unlockedPicks.length > 0 && !isRoundSubmitted;
  const isRoundFullyLocked =
    canInteract && activeMatches.length > 0 && activeMatches.every(m => isMatchLocked(m));

  const roundPickCount = (round: number) =>
    Object.keys(picks).filter(k => k.startsWith(`${round}-`)).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ROUNDS.map(round => (
          <RoundTab
            key={round}
            label={ROUND_LABELS[round]}
            pickCount={roundPickCount(round)}
            total={ROUND_SLOTS[round]}
            active={activeRound === round}
            onClick={() => setActiveRound(round)}
          />
        ))}
      </div>

      <div className="space-y-3">
        {activeMatches.map(match => (
          <BracketCard
            key={`${match.round}-${match.slot}`}
            match={match}
            pick={picks[`${match.round}-${match.slot}`] ?? null}
            onPick={(teamId) => handlePick(match.round, match.slot, teamId)}
            locked={!canInteract || isMatchLocked(match)}
          />
        ))}
      </div>

      {showSubmitButton && (
        <div className="sticky bottom-20 pt-2">
          {submitErrors[activeRound] && (
            <p className="text-center text-sm mb-2" style={{ color: '#EF4444' }}>
              {submitErrors[activeRound]}
            </p>
          )}
          <button
            onClick={() => handleRoundSubmit(activeRound)}
            disabled={submitting !== null}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all"
            style={{ background: 'var(--brand-green)', color: '#000', cursor: 'pointer' }}
          >
            {submitting === activeRound
              ? 'Enviando…'
              : `Confirmar ${ROUND_LABELS[activeRound]} (${unlockedPicks.length} ${unlockedPicks.length === 1 ? 'pick' : 'picks'})`}
          </button>
        </div>
      )}

      {isRoundSubmitted && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.3)',
          }}
        >
          <p className="font-semibold" style={{ color: 'var(--brand-green)' }}>
            ✓ {ROUND_LABELS[activeRound]} confirmado!
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Acompanhe os resultados aqui conforme os jogos acontecem.
          </p>
        </div>
      )}

      {isRoundFullyLocked && !isRoundSubmitted && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            🔒 Todos os jogos do {ROUND_LABELS[activeRound]} já começaram
          </p>
        </div>
      )}
    </div>
  );
}
