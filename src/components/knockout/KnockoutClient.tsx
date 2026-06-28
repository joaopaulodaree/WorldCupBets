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
  existingPicks: Record<string, string>; // "round-slot" → teamId
  bracketState: BracketState;
  userId: string;
  roundLocked: Record<number, boolean>;
  submittedRounds: Record<number, boolean>;
}

function draftKey(userId: string) {
  return `mata-mata-draft-${userId}`;
}

export function KnockoutClient({
  matches,
  existingPicks,
  bracketState,
  userId,
  roundLocked,
  submittedRounds: initialSubmittedRounds,
}: Props) {
  // Default to the first open round, falling back to round 5
  const firstOpenRound = ROUNDS.find(r => !roundLocked[r]) ?? 5;
  const [activeRound, setActiveRound] = useState(firstOpenRound);

  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const base = { ...existingPicks };
    if (typeof window !== 'undefined') {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey(userId)) ?? '{}') as Record<string, string>;
        if (bracketState === 'available_for_picks') {
          Object.assign(base, draft);
        }
      } catch {
        // ignore parse errors
      }
    }
    return base;
  });

  const [submittedRounds, setSubmittedRounds] = useState<Record<number, boolean>>(initialSubmittedRounds);
  const [submitting, setSubmitting] = useState<number | null>(null); // round currently being submitted
  const [submitErrors, setSubmitErrors] = useState<Record<number, string>>({});

  // Persist draft picks to localStorage
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
  }, []);

  const roundPickCount = (round: number) =>
    Object.keys(picks).filter(k => k.startsWith(`${round}-`)).length;

  async function handleRoundSubmit(round: number) {
    if (submitting !== null) return;
    setSubmitting(round);
    setSubmitErrors(prev => { const n = { ...prev }; delete n[round]; return n; });

    const expectedSlots = ROUND_SLOTS[round];
    const pickList = Array.from({ length: expectedSlots }, (_, s) => ({
      slot: s,
      teamId: picks[`${round}-${s}`] ?? '',
    }));

    try {
      const res = await fetch('/api/bracket/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round, picks: pickList }),
      });

      if (res.status === 409) {
        // Round already locked or already submitted — treat as success
        setSubmittedRounds(prev => ({ ...prev, [round]: true }));
        clearDraftRound(round, expectedSlots);
        return;
      }

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSubmitErrors(prev => ({ ...prev, [round]: body.error ?? 'Erro ao enviar picks' }));
        return;
      }

      setSubmittedRounds(prev => ({ ...prev, [round]: true }));
      clearDraftRound(round, expectedSlots);
    } catch {
      setSubmitErrors(prev => ({ ...prev, [round]: 'Erro de rede. Tente novamente.' }));
    } finally {
      setSubmitting(null);
    }
  }

  function clearDraftRound(round: number, slotCount: number) {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey(userId)) ?? '{}') as Record<string, string>;
      for (let s = 0; s < slotCount; s++) delete draft[`${round}-${s}`];
      localStorage.setItem(draftKey(userId), JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }

  const matchesByRound = (round: number) =>
    matches.filter(m => m.round === round).sort((a, b) => a.slot - b.slot);

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

  const isRoundLocked = roundLocked[activeRound] ?? false;
  const isRoundSubmitted = submittedRounds[activeRound] ?? false;
  const activePickCount = roundPickCount(activeRound);
  const activeExpected = ROUND_SLOTS[activeRound] ?? 0;
  const allActivePicksDone = activePickCount === activeExpected;

  return (
    <div className="space-y-4">
      {/* Round tabs */}
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

      {/* Match cards for active round */}
      <div className="space-y-3">
        {matchesByRound(activeRound).map(match => (
          <BracketCard
            key={`${match.round}-${match.slot}`}
            match={match}
            pick={picks[`${match.round}-${match.slot}`] ?? null}
            onPick={(teamId) => handlePick(match.round, match.slot, teamId)}
            locked={isRoundLocked || isRoundSubmitted}
          />
        ))}
      </div>

      {/* Per-round submit button — only for open, unsubmitted rounds */}
      {!isRoundLocked && !isRoundSubmitted && (
        <div className="sticky bottom-20 pt-2">
          {submitErrors[activeRound] && (
            <p className="text-center text-sm mb-2" style={{ color: '#EF4444' }}>
              {submitErrors[activeRound]}
            </p>
          )}
          <button
            onClick={() => handleRoundSubmit(activeRound)}
            disabled={!allActivePicksDone || submitting !== null}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all"
            style={{
              background: allActivePicksDone ? 'var(--brand-green)' : 'var(--bg-secondary)',
              color: allActivePicksDone ? '#000' : 'var(--text-tertiary)',
              cursor: allActivePicksDone ? 'pointer' : 'default',
            }}
          >
            {submitting === activeRound
              ? 'Enviando…'
              : allActivePicksDone
              ? `Confirmar ${ROUND_LABELS[activeRound]} (${activePickCount}/${activeExpected})`
              : `Preencha os picks (${activePickCount}/${activeExpected})`}
          </button>
        </div>
      )}

      {/* Round submitted confirmation */}
      {isRoundSubmitted && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--brand-green)' }}>
            ✓ {ROUND_LABELS[activeRound]} confirmado!
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Acompanhe os resultados aqui conforme os jogos acontecem.
          </p>
        </div>
      )}

      {/* Round locked without submission */}
      {isRoundLocked && !isRoundSubmitted && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            🔒 {ROUND_LABELS[activeRound]} bloqueado — jogos já começaram
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Seus picks não foram confirmados a tempo para esta rodada.
          </p>
        </div>
      )}
    </div>
  );
}
