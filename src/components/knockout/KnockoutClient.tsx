'use client';

import { useState, useCallback } from 'react';
import { BracketScoreCard } from './BracketScoreCard';
import { RoundTab } from './RoundTab';
import { toGoals, ROUNDS, ROUND_SLOTS, ROUND_LABELS, type TeamInfo } from '@/lib/knockout/bracketLogic';

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

type PickState = Record<string, { homeGoals: string; awayGoals: string }>;

export function KnockoutClient({ matches, existingScorePicks, bracketState }: Props) {
  const locked = bracketState !== 'available_for_picks';

  // Index DB matches by "round-slot" — API populates correct Copa 2026 bracket structure
  const matchMap = new Map<string, KnockoutMatchWithTeams>(
    matches.map((m) => [`${m.round}-${m.slot}`, m]),
  );

  // Individually lock matches that have already started or finished
  const startedMatchKeys = new Set(
    matches
      .filter((m) => m.status === 'live' || m.status === 'finished')
      .map((m) => `${m.round}-${m.slot}`),
  );

  const actualWinnerMap = new Map<string, string>(
    matches
      .filter((m) => m.winnerTeamId !== null)
      .map((m) => [`${m.round}-${m.slot}`, m.winnerTeamId!]),
  );

  const [activeRound, setActiveRound] = useState(5);
  const [scorePicks, setScorePicks] = useState<PickState>(() => {
    const base: PickState = {};
    for (const [key, pick] of Object.entries(existingScorePicks)) {
      if (pick.homeGoals !== null && pick.awayGoals !== null) {
        base[key] = { homeGoals: String(pick.homeGoals), awayGoals: String(pick.awayGoals) };
      }
    }
    return base;
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleGoalsChange = useCallback(
    (round: number, slot: number, side: 'home' | 'away', value: string) => {
      setSaveSuccess(false);
      setSubmitError(null);
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

  // Get all slots for a round — DB teams if known, null if not yet assigned
  const getSlots = (round: number) =>
    Array.from({ length: ROUND_SLOTS[round] }, (_, slot) => {
      const m = matchMap.get(`${round}-${slot}`);
      return { slot, homeTeam: m?.homeTeam ?? null, awayTeam: m?.awayTeam ?? null };
    });

  // Matches that can be picked: both teams known + not yet started
  const pickableForRound = (round: number) =>
    getSlots(round).filter(
      ({ slot, homeTeam, awayTeam }) =>
        homeTeam && awayTeam && !startedMatchKeys.has(`${round}-${slot}`),
    );

  const roundPickCount = (round: number) =>
    pickableForRound(round).filter(({ slot }) => {
      const pick = scorePicks[`${round}-${slot}`];
      const h = toGoals(pick?.homeGoals);
      const a = toGoals(pick?.awayGoals);
      return h !== null && a !== null && h !== a;
    }).length;

  const roundTotal = (round: number) => pickableForRound(round).length;

  const allPickable = ROUNDS.flatMap((r) =>
    pickableForRound(r).map(({ slot, homeTeam, awayTeam }) => ({
      round: r,
      slot,
      homeTeam,
      awayTeam,
    })),
  );

  const validPickCount = allPickable.filter(({ round, slot }) => {
    const pick = scorePicks[`${round}-${slot}`];
    const h = toGoals(pick?.homeGoals);
    const a = toGoals(pick?.awayGoals);
    return h !== null && a !== null && h !== a;
  }).length;

  async function handleSubmit() {
    if (submitting || validPickCount === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    const pickList = allPickable.flatMap(({ round, slot, homeTeam, awayTeam }) => {
      const pick = scorePicks[`${round}-${slot}`];
      const h = toGoals(pick?.homeGoals);
      const a = toGoals(pick?.awayGoals);
      if (h === null || a === null || h === a) return [];
      const winner = h > a ? homeTeam! : awayTeam!;
      return [{ round, slot, teamId: winner.id, homeGoals: h, awayGoals: a }];
    });

    try {
      const res = await fetch('/api/bracket/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: pickList }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setSubmitError(body.error ?? 'Erro ao salvar palpites');
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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

  const activeSlots = getSlots(activeRound);

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

      {/* Match cards — teams from DB (API owns correct Copa 2026 bracket structure) */}
      <div className="space-y-3">
        {activeSlots.map(({ slot, homeTeam, awayTeam }) => {
          const key = `${activeRound}-${slot}`;
          const pick = scorePicks[key];
          const isStarted = startedMatchKeys.has(key);
          return (
            <BracketScoreCard
              key={key}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeGoals={pick?.homeGoals ?? ''}
              awayGoals={pick?.awayGoals ?? ''}
              onHomeChange={(v) => handleGoalsChange(activeRound, slot, 'home', v)}
              onAwayChange={(v) => handleGoalsChange(activeRound, slot, 'away', v)}
              locked={locked || isStarted}
              actualWinnerId={actualWinnerMap.get(key) ?? null}
            />
          );
        })}
      </div>

      {/* Save button — shown whenever bracket window is open, not just before first submit */}
      {bracketState === 'available_for_picks' && (
        <div className="sticky bottom-20 pt-2">
          {submitError && (
            <p className="text-center text-sm mb-2" style={{ color: '#EF4444' }}>
              {submitError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-center text-sm mb-2" style={{ color: 'var(--brand-green)' }}>
              ✓ Palpites salvos!
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || validPickCount === 0}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all"
            style={{
              background: validPickCount > 0 ? 'var(--brand-green)' : 'var(--bg-secondary)',
              color: validPickCount > 0 ? '#000' : 'var(--text-tertiary)',
              cursor: validPickCount > 0 ? 'pointer' : 'default',
            }}
          >
            {submitting
              ? 'Salvando…'
              : validPickCount > 0
                ? `Salvar palpites (${validPickCount}/${allPickable.length})`
                : 'Preencha os palpites'}
          </button>
        </div>
      )}
    </div>
  );
}
