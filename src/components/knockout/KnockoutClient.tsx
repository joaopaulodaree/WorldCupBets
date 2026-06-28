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
  5: '32-avos',    // R32: 16 matches
  6: 'Oitavas',   // R16: 8 matches
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
}

function draftKey(userId: string) {
  return `mata-mata-draft-${userId}`;
}

export function KnockoutClient({ matches, existingPicks, bracketState, userId }: Props) {
  const [activeRound, setActiveRound] = useState(5);
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    // Seed from existing submitted picks; then merge localStorage draft
    const base = { ...existingPicks };
    if (typeof window !== 'undefined') {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey(userId)) ?? '{}') as Record<string, string>;
        // Draft only applies if bracket is still open
        if (bracketState === 'available_for_picks') {
          Object.assign(base, draft);
        }
      } catch {
        // ignore parse errors
      }
    }
    return base;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(bracketState !== 'available_for_picks' && Object.keys(existingPicks).length > 0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const locked = bracketState !== 'available_for_picks';

  // Persist draft to localStorage on every pick change
  useEffect(() => {
    if (bracketState !== 'available_for_picks') return;
    try {
      localStorage.setItem(draftKey(userId), JSON.stringify(picks));
    } catch {
      // ignore storage errors
    }
  }, [picks, userId, bracketState]);

  const handlePick = useCallback((round: number, slot: number, teamId: string) => {
    const key = `${round}-${slot}`;
    setPicks(prev => ({ ...prev, [key]: teamId }));
  }, []);

  const totalPicks = Object.keys(picks).length;
  const roundPickCount = (round: number) =>
    Object.keys(picks).filter(k => k.startsWith(`${round}-`)).length;

  const allPicksDone = totalPicks === 31;

  async function handleSubmit() {
    if (!allPicksDone || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const pickList = Object.entries(picks).map(([key, teamId]) => {
      const [round, slot] = key.split('-').map(Number);
      return { round, slot, teamId };
    });

    try {
      const res = await fetch('/api/bracket/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: pickList }),
      });

      if (res.status === 409) {
        // Already submitted — treat as success
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
            locked={locked || submitted}
          />
        ))}
      </div>

      {/* Submit button */}
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
            {submitting ? 'Enviando…' : allPicksDone ? `Confirmar bracket (${totalPicks}/31)` : `Preencha todos os picks (${totalPicks}/31)`}
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
