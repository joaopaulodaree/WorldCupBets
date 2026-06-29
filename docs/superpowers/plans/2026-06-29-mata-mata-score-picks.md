# Mata-Mata Score Picks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace team-click bracket picks with score inputs (home goals vs away goals), deriving each subsequent round's teams from the predicted winners of the previous round.

**Architecture:** Score-based picks replace `team_id`-only picks. The DB gains `home_goals`/`away_goals` on `bracket_picks`. The bracket logic is pure functions that compute each round's teams recursively from the previous round's predicted winners. The submit API derives `team_id` (winner) from the score. The scoring cron (`sync-bracket-points`) requires no changes — it still compares `bracket_picks.team_id` with `knockout_matches.winner_team_id`.

**Tech Stack:** Next.js 16, React, Supabase (Postgres), TypeScript, Tailwind/CSS variables, Vitest (existing test runner).

## Global Constraints

- All UI uses CSS variables (`var(--brand-green)`, `var(--text-primary)`, etc.) — no hardcoded colors except rgba overlays.
- No draws allowed in knockout predictions: `home_goals !== away_goals` required.
- `bracket_picks.team_id` must remain the **predicted winner** (used by `sync-bracket-points` cron — do NOT remove or nullify it).
- Draft picks live in `localStorage` under key `mata-mata-draft-${userId}` until submitted; cleared on submit.
- Build must pass: `npm run build` — zero type errors.
- Migration file naming: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `supabase/migrations/20260629000001_bracket_score_picks.sql` | **Create** | Add `home_goals`, `away_goals` columns to `bracket_picks` |
| `src/lib/knockout/bracketLogic.ts` | **Create** | Pure functions: `toGoals`, `deriveWinner`, `getMatchTeams`, `computeAllMatches` |
| `src/lib/knockout/bracketLogic.test.ts` | **Create** | Unit tests for bracket logic |
| `src/components/knockout/BracketScoreCard.tsx` | **Create** | Score-input card (replaces `BracketCard`) |
| `src/components/knockout/BracketCard.tsx` | **Delete** | Replaced by `BracketScoreCard`; types moved to `KnockoutClient` |
| `src/components/knockout/KnockoutClient.tsx` | **Rewrite** | Cascading score picks, new state shape, updated submit payload |
| `src/components/knockout/RoundTab.tsx` | **No change** | Receives same `pickCount`/`total` props |
| `src/app/(app)/knockout/page.tsx` | **Modify** | Fetch `home_goals`/`away_goals` from `bracket_picks`; update prop types |
| `src/app/api/bracket/submit/route.ts` | **Modify** | Accept `homeGoals`/`awayGoals`; validate no draws; store scores |
| `src/app/api/bracket/submit/route.test.ts` | **Modify** | Update tests for new payload shape |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260629000001_bracket_score_picks.sql`

**Interfaces:**
- Produces: `bracket_picks` table with `home_goals smallint`, `away_goals smallint` (nullable, CHECK >= 0)

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260629000001_bracket_score_picks.sql
-- Add score columns for score-based bracket predictions.
-- team_id (predicted winner) is derived from goals on submit and remains non-null.
ALTER TABLE public.bracket_picks
  ADD COLUMN home_goals smallint CHECK (home_goals >= 0),
  ADD COLUMN away_goals smallint CHECK (away_goals >= 0);
```

- [ ] **Step 2: Apply via Supabase dashboard**

Open the Supabase SQL editor, paste the migration, and run it.
Verify with: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bracket_picks';`
Expected: `home_goals` and `away_goals` appear with `smallint` type.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260629000001_bracket_score_picks.sql
git commit -m "feat: add home_goals/away_goals to bracket_picks for score-based predictions"
```

---

## Task 2: Bracket Logic (pure functions)

**Files:**
- Create: `src/lib/knockout/bracketLogic.ts`
- Create: `src/lib/knockout/bracketLogic.test.ts`

**Interfaces:**
- Produces:
  - `type TeamInfo = { id: string; name: string; code: string; flagUrl: string }`
  - `type ScorePick = { homeGoals: string; awayGoals: string }` (string for input binding)
  - `type ScorePicks = Record<string, ScorePick>` (key = `"round-slot"`)
  - `function toGoals(v: string): number | null` — parses input string to int ≥ 0, or null
  - `function deriveWinner(home: TeamInfo | null, away: TeamInfo | null, pick: ScorePick | undefined): TeamInfo | null`
  - `function getMatchTeams(round: number, slot: number, scorePicks: ScorePicks, r32Teams: Map<string, { home: TeamInfo | null; away: TeamInfo | null }>): { home: TeamInfo | null; away: TeamInfo | null }`
  - `function computeAllMatches(scorePicks: ScorePicks, r32Teams: Map<string, { home: TeamInfo | null; away: TeamInfo | null }>): Array<{ round: number; slot: number; home: TeamInfo | null; away: TeamInfo | null }>`
  - `const ROUNDS: number[]` = `[5, 6, 7, 8, 9]`
  - `const ROUND_SLOTS: Record<number, number>` = `{ 5: 16, 6: 8, 7: 4, 8: 2, 9: 1 }`
  - `const ROUND_LABELS: Record<number, string>` = `{ 5: '32-avos', 6: 'Oitavas', 7: 'Quartas', 8: 'Semi', 9: 'Final' }`

**Slot mapping:** round `r+1` slot `k` has home = winner of round `r` slot `2k`, away = winner of round `r` slot `2k+1`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/knockout/bracketLogic.test.ts
import { describe, it, expect } from 'vitest';
import {
  toGoals,
  deriveWinner,
  getMatchTeams,
  computeAllMatches,
  ROUNDS,
  ROUND_SLOTS,
  type TeamInfo,
  type ScorePicks,
} from './bracketLogic';

const BRA: TeamInfo = { id: 'bra', name: 'Brasil', code: 'BRA', flagUrl: '/bra.png' };
const ARG: TeamInfo = { id: 'arg', name: 'Argentina', code: 'ARG', flagUrl: '/arg.png' };
const ESP: TeamInfo = { id: 'esp', name: 'Espanha', code: 'ESP', flagUrl: '/esp.png' };
const FRA: TeamInfo = { id: 'fra', name: 'França', code: 'FRA', flagUrl: '/fra.png' };

function makeR32Map(entries: Array<[number, TeamInfo | null, TeamInfo | null]>) {
  const map = new Map<string, { home: TeamInfo | null; away: TeamInfo | null }>();
  for (const [slot, home, away] of entries) {
    map.set(`5-${slot}`, { home, away });
  }
  return map;
}

describe('toGoals', () => {
  it('parses valid integer string', () => expect(toGoals('2')).toBe(2));
  it('parses zero', () => expect(toGoals('0')).toBe(0));
  it('returns null for empty string', () => expect(toGoals('')).toBeNull());
  it('returns null for NaN', () => expect(toGoals('abc')).toBeNull());
  it('returns null for negative', () => expect(toGoals('-1')).toBeNull());
});

describe('deriveWinner', () => {
  it('returns home when home goals > away goals', () => {
    expect(deriveWinner(BRA, ARG, { homeGoals: '2', awayGoals: '1' })).toBe(BRA);
  });
  it('returns away when away goals > home goals', () => {
    expect(deriveWinner(BRA, ARG, { homeGoals: '0', awayGoals: '1' })).toBe(ARG);
  });
  it('returns null for draw', () => {
    expect(deriveWinner(BRA, ARG, { homeGoals: '1', awayGoals: '1' })).toBeNull();
  });
  it('returns null when pick is undefined', () => {
    expect(deriveWinner(BRA, ARG, undefined)).toBeNull();
  });
  it('returns null when home team is null', () => {
    expect(deriveWinner(null, ARG, { homeGoals: '2', awayGoals: '1' })).toBeNull();
  });
  it('returns null when away team is null', () => {
    expect(deriveWinner(BRA, null, { homeGoals: '2', awayGoals: '1' })).toBeNull();
  });
});

describe('getMatchTeams', () => {
  const r32 = makeR32Map([[0, BRA, ARG], [1, ESP, FRA]]);

  it('returns DB teams for R32 (round 5)', () => {
    const result = getMatchTeams(5, 0, {}, r32);
    expect(result).toEqual({ home: BRA, away: ARG });
  });

  it('returns null teams for R32 slot with no entry', () => {
    const result = getMatchTeams(5, 99, {}, r32);
    expect(result).toEqual({ home: null, away: null });
  });

  it('derives R16 teams from R32 winners', () => {
    const picks: ScorePicks = {
      '5-0': { homeGoals: '2', awayGoals: '1' }, // BRA wins
      '5-1': { homeGoals: '0', awayGoals: '1' }, // FRA wins
    };
    const result = getMatchTeams(6, 0, picks, r32);
    expect(result).toEqual({ home: BRA, away: FRA });
  });

  it('returns null home when R32 slot 0 has no pick', () => {
    const picks: ScorePicks = {
      '5-1': { homeGoals: '0', awayGoals: '1' }, // FRA wins, slot 0 missing
    };
    const result = getMatchTeams(6, 0, picks, r32);
    expect(result.home).toBeNull();
    expect(result.away).toBe(FRA);
  });

  it('derives QF teams from R16 winners', () => {
    // R32: slot 0 BRA vs ARG, slot 1 ESP vs FRA, slot 2 BRA vs ARG, slot 3 ESP vs FRA
    const r32ext = makeR32Map([[0, BRA, ARG], [1, ESP, FRA], [2, BRA, ARG], [3, ESP, FRA]]);
    const picks: ScorePicks = {
      '5-0': { homeGoals: '2', awayGoals: '0' }, // BRA
      '5-1': { homeGoals: '0', awayGoals: '1' }, // FRA
      '5-2': { homeGoals: '1', awayGoals: '0' }, // BRA
      '5-3': { homeGoals: '2', awayGoals: '1' }, // ESP
      '6-0': { homeGoals: '3', awayGoals: '1' }, // BRA beats FRA → QF home
      '6-1': { homeGoals: '0', awayGoals: '2' }, // ESP beats BRA → QF away
    };
    const result = getMatchTeams(7, 0, picks, r32ext);
    expect(result).toEqual({ home: BRA, away: ESP });
  });
});

describe('computeAllMatches', () => {
  it('returns 31 entries for ROUNDS × ROUND_SLOTS', () => {
    const r32 = makeR32Map(
      Array.from({ length: 16 }, (_, i) => [i, BRA, ARG] as [number, TeamInfo, TeamInfo])
    );
    const result = computeAllMatches({}, r32);
    expect(result).toHaveLength(31);
    expect(result.filter(m => m.round === 5)).toHaveLength(16);
    expect(result.filter(m => m.round === 6)).toHaveLength(8);
  });
});

describe('ROUNDS and ROUND_SLOTS', () => {
  it('ROUNDS has 5 entries', () => expect(ROUNDS).toHaveLength(5));
  it('total slots sum to 31', () => {
    const total = ROUNDS.reduce((sum, r) => sum + ROUND_SLOTS[r], 0);
    expect(total).toBe(31);
  });
});
```

- [ ] **Step 2: Run tests — expect all to FAIL**

```bash
cd /Users/joaopaulodare/Developer/worldcupbets-app
npx vitest run src/lib/knockout/bracketLogic.test.ts
```

Expected: module not found / import errors.

- [ ] **Step 3: Create the bracket logic module**

```ts
// src/lib/knockout/bracketLogic.ts

export type TeamInfo = { id: string; name: string; code: string; flagUrl: string };
export type ScorePick = { homeGoals: string; awayGoals: string };
export type ScorePicks = Record<string, ScorePick>; // key = "round-slot"

export const ROUNDS = [5, 6, 7, 8, 9];
export const ROUND_SLOTS: Record<number, number> = { 5: 16, 6: 8, 7: 4, 8: 2, 9: 1 };
export const ROUND_LABELS: Record<number, string> = {
  5: '32-avos',
  6: 'Oitavas',
  7: 'Quartas',
  8: 'Semi',
  9: 'Final',
};

export function toGoals(v: string): number | null {
  if (v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) || n < 0 ? null : n;
}

export function deriveWinner(
  home: TeamInfo | null,
  away: TeamInfo | null,
  pick: ScorePick | undefined,
): TeamInfo | null {
  if (!pick || !home || !away) return null;
  const h = toGoals(pick.homeGoals);
  const a = toGoals(pick.awayGoals);
  if (h === null || a === null || h === a) return null;
  return h > a ? home : away;
}

export function getMatchTeams(
  round: number,
  slot: number,
  scorePicks: ScorePicks,
  r32Teams: Map<string, { home: TeamInfo | null; away: TeamInfo | null }>,
): { home: TeamInfo | null; away: TeamInfo | null } {
  if (round === 5) {
    const entry = r32Teams.get(`5-${slot}`);
    return { home: entry?.home ?? null, away: entry?.away ?? null };
  }
  const prevRound = round - 1;
  const homeMatchTeams = getMatchTeams(prevRound, slot * 2, scorePicks, r32Teams);
  const awayMatchTeams = getMatchTeams(prevRound, slot * 2 + 1, scorePicks, r32Teams);
  return {
    home: deriveWinner(homeMatchTeams.home, homeMatchTeams.away, scorePicks[`${prevRound}-${slot * 2}`]),
    away: deriveWinner(awayMatchTeams.home, awayMatchTeams.away, scorePicks[`${prevRound}-${slot * 2 + 1}`]),
  };
}

export function computeAllMatches(
  scorePicks: ScorePicks,
  r32Teams: Map<string, { home: TeamInfo | null; away: TeamInfo | null }>,
): Array<{ round: number; slot: number; home: TeamInfo | null; away: TeamInfo | null }> {
  return ROUNDS.flatMap((round) =>
    Array.from({ length: ROUND_SLOTS[round] }, (_, slot) => {
      const { home, away } = getMatchTeams(round, slot, scorePicks, r32Teams);
      return { round, slot, home, away };
    }),
  );
}
```

- [ ] **Step 4: Run tests — expect all to PASS**

```bash
npx vitest run src/lib/knockout/bracketLogic.test.ts
```

Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knockout/bracketLogic.ts src/lib/knockout/bracketLogic.test.ts
git commit -m "feat: add bracket logic pure functions with tests"
```

---

## Task 3: BracketScoreCard Component

**Files:**
- Create: `src/components/knockout/BracketScoreCard.tsx`
- Delete: `src/components/knockout/BracketCard.tsx` (at end of Task 4 once imports updated)

**Interfaces:**
- Consumes: `TeamInfo` from `src/lib/knockout/bracketLogic`
- Produces: `BracketScoreCard` component
  - Props: `{ homeTeam: TeamInfo | null; awayTeam: TeamInfo | null; homeGoals: string; awayGoals: string; onHomeChange: (v: string) => void; onAwayChange: (v: string) => void; locked: boolean; actualWinnerId?: string | null }`
- When `locked=false`: renders two rows each with flag+name + score input.
- When `locked=true`: renders two rows each with flag+name + score text. Predicted winner (derived from goals) shown in green. Actual winner (from `actualWinnerId`) overrides predicted highlight when set.
- TBD team (null): renders placeholder "A definir" row without input.

- [ ] **Step 1: Create the component**

```tsx
// src/components/knockout/BracketScoreCard.tsx
'use client';

import Image from 'next/image';
import type { TeamInfo } from '@/lib/knockout/bracketLogic';
import { toGoals } from '@/lib/knockout/bracketLogic';

interface Props {
  homeTeam: TeamInfo | null;
  awayTeam: TeamInfo | null;
  homeGoals: string;
  awayGoals: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
  locked: boolean;
  actualWinnerId?: string | null;
}

function ScoreInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="–"
      aria-label={label}
      className="w-11 h-11 text-center font-display text-2xl rounded-xl focus:outline-none flex-shrink-0"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1.5px solid var(--border-bright)',
        color: 'var(--text-primary)',
        caretColor: 'var(--brand-green)',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--brand-green)';
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,196,74,0.2)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-bright)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

function TeamRow({
  team,
  goals,
  locked,
  onGoalsChange,
  isWinner,
  isLoser,
}: {
  team: TeamInfo | null;
  goals: string;
  locked: boolean;
  onGoalsChange: (v: string) => void;
  isWinner: boolean;
  isLoser: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 py-2 opacity-40">
        <div className="w-6 h-4 rounded bg-gray-700 flex-shrink-0" />
        <span className="text-sm flex-1" style={{ color: 'var(--text-tertiary)' }}>
          A definir
        </span>
        {locked ? (
          <span className="w-8 text-right text-lg font-display" style={{ color: 'var(--text-tertiary)' }}>–</span>
        ) : (
          <div className="w-11 h-11" />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 py-2 transition-opacity ${isLoser ? 'opacity-40' : ''}`}>
      <Image
        src={team.flagUrl}
        alt={team.name}
        width={24}
        height={16}
        className="rounded-sm flex-shrink-0 object-cover"
        style={{ width: 24, height: 16 }}
        unoptimized
      />
      <span
        className="text-sm font-medium truncate flex-1"
        style={{ color: isWinner ? 'var(--brand-green)' : 'var(--text-primary)' }}
      >
        {team.name}
      </span>
      {isWinner && !locked && (
        <span className="text-green-400 text-xs flex-shrink-0 mr-1">▲</span>
      )}
      {locked ? (
        <span
          className="w-8 text-right text-lg font-display flex-shrink-0"
          style={{ color: isWinner ? 'var(--brand-green)' : 'var(--text-tertiary)' }}
        >
          {goals !== '' ? goals : '–'}
        </span>
      ) : (
        <ScoreInput value={goals} onChange={onGoalsChange} label={`Gols ${team.code}`} />
      )}
    </div>
  );
}

export function BracketScoreCard({
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
  onHomeChange,
  onAwayChange,
  locked,
  actualWinnerId,
}: Props) {
  const h = toGoals(homeGoals);
  const a = toGoals(awayGoals);
  const predictedWinnerId =
    h !== null && a !== null && h !== a
      ? h > a
        ? homeTeam?.id
        : awayTeam?.id
      : undefined;

  const effectiveWinnerId = actualWinnerId ?? predictedWinnerId;

  const homeIsWinner = !!effectiveWinnerId && effectiveWinnerId === homeTeam?.id;
  const awayIsWinner = !!effectiveWinnerId && effectiveWinnerId === awayTeam?.id;
  const homeIsLoser = !!effectiveWinnerId && !homeIsWinner && homeTeam !== null;
  const awayIsLoser = !!effectiveWinnerId && !awayIsWinner && awayTeam !== null;

  return (
    <div
      className="rounded-2xl px-3 divide-y"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        divideColor: 'var(--border-color)',
      }}
    >
      <TeamRow
        team={homeTeam}
        goals={homeGoals}
        locked={locked}
        onGoalsChange={onHomeChange}
        isWinner={homeIsWinner}
        isLoser={homeIsLoser}
      />
      <TeamRow
        team={awayTeam}
        goals={awayGoals}
        locked={locked}
        onGoalsChange={onAwayChange}
        isWinner={awayIsWinner}
        isLoser={awayIsLoser}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in BracketScoreCard.tsx.

- [ ] **Step 3: Commit**

```bash
git add src/components/knockout/BracketScoreCard.tsx
git commit -m "feat: add BracketScoreCard with score inputs and cascading winner highlight"
```

---

## Task 4: Rewrite KnockoutClient

**Files:**
- Rewrite: `src/components/knockout/KnockoutClient.tsx`
- Delete: `src/components/knockout/BracketCard.tsx`

**Interfaces:**
- Consumes:
  - `computeAllMatches`, `ScorePicks`, `TeamInfo`, `ROUNDS`, `ROUND_SLOTS`, `ROUND_LABELS`, `toGoals`, `deriveWinner`, `getMatchTeams` from `@/lib/knockout/bracketLogic`
  - `BracketScoreCard` from `./BracketScoreCard`
  - `RoundTab` from `./RoundTab`
- Produces:
  - `export type BracketState` = `'locked_pending_groups' | 'available_for_picks' | 'picks_locked' | 'results_revealing' | 'completed'`
  - `export type KnockoutMatchWithTeams` — moved here from BracketCard so page.tsx can import it
  - `export function KnockoutClient` props:
    ```ts
    {
      matches: KnockoutMatchWithTeams[];
      existingScorePicks: Record<string, { homeGoals: number | null; awayGoals: number | null }>;
      bracketState: BracketState;
      userId: string;
    }
    ```

**State shape:**
```ts
const [scorePicks, setScorePicks] = useState<ScorePicks>(() => { ... });
const [activeRound, setActiveRound] = useState(5);
const [submitting, setSubmitting] = useState(false);
const [submitted, setSubmitted] = useState(false);
const [submitError, setSubmitError] = useState<string | null>(null);
```

**Derived data (computed each render, not in state):**
- `r32TeamsMap`: built once from `matches` where `m.round === 5`
- `actualWinnerMap`: built from `matches` where `m.winnerTeamId !== null`
- `allMatches`: result of `computeAllMatches(scorePicks, r32TeamsMap)`
- `matchesWithTeams`: `allMatches.filter(m => m.home && m.away)`
- `validPickCount`: count of `matchesWithTeams` that have a non-draw pick
- `allPicksDone`: `matchesWithTeams.length > 0 && validPickCount === matchesWithTeams.length`

**`draftKey`:** `mata-mata-draft-${userId}` (unchanged, but now stores `ScorePicks` not `Record<string,string>`)

**Submit payload:** `{ picks: [{ round, slot, teamId: string, homeGoals: number, awayGoals: number }] }`

- [ ] **Step 1: Rewrite KnockoutClient.tsx**

```tsx
// src/components/knockout/KnockoutClient.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { BracketScoreCard } from './BracketScoreCard';
import { RoundTab } from './RoundTab';
import {
  computeAllMatches,
  getMatchTeams,
  toGoals,
  deriveWinner,
  ROUNDS,
  ROUND_SLOTS,
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
              locked={locked || submitted}
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
```

- [ ] **Step 2: Delete BracketCard.tsx**

```bash
rm /Users/joaopaulodare/Developer/worldcupbets-app/src/components/knockout/BracketCard.tsx
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: compiled successfully, zero type errors. Fix any import errors from the deleted file.

- [ ] **Step 4: Commit**

```bash
git add src/components/knockout/KnockoutClient.tsx src/components/knockout/BracketScoreCard.tsx
git rm src/components/knockout/BracketCard.tsx
git commit -m "feat: rewrite KnockoutClient with cascading score-based bracket predictions"
```

---

## Task 5: Update Knockout Page

**Files:**
- Modify: `src/app/(app)/knockout/page.tsx`

**Changes:**
- Import `KnockoutMatchWithTeams` from `@/components/knockout/KnockoutClient` (moved from BracketCard).
- Fetch `home_goals`, `away_goals` from `bracket_picks`.
- Pass `existingScorePicks` prop instead of `existingPicks`.
- Remove `existingPicks` variable entirely.

- [ ] **Step 1: Update the page**

Replace the entire file content:

```tsx
// src/app/(app)/knockout/page.tsx
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { KnockoutClient, type BracketState, type KnockoutMatchWithTeams } from '@/components/knockout/KnockoutClient';

type RawTeam = { id: string; name: string; code: string; flag_url: string } | null;

interface RawMatch {
  id: string;
  round: number;
  slot: number;
  kickoff_at: string | null;
  status: string;
  winner_team_id: string | null;
  home_team: RawTeam;
  away_team: RawTeam;
}

async function getBracketData(userId: string | null) {
  const admin = createAdminClient();

  const [{ count: unfinished }, { count: populatedR32 }] = await Promise.all([
    admin.from('matches').select('id', { count: 'exact', head: true }).neq('status', 'finished'),
    admin
      .from('knockout_matches')
      .select('id', { count: 'exact', head: true })
      .eq('round', 5)
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null),
  ]);

  const groupsFinished = (unfinished ?? 1) === 0;
  const r32Ready = (populatedR32 ?? 0) >= 16;

  if (!groupsFinished || !r32Ready) {
    return {
      bracketState: 'locked_pending_groups' as BracketState,
      matches: [] as KnockoutMatchWithTeams[],
      existingScorePicks: {} as Record<string, { homeGoals: number | null; awayGoals: number | null }>,
    };
  }

  const { data: firstR32 } = await admin
    .from('knockout_matches')
    .select('kickoff_at')
    .eq('round', 5)
    .not('kickoff_at', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1);

  const firstKickoff = firstR32?.[0]?.kickoff_at ? new Date(firstR32[0].kickoff_at) : null;
  const bracketLocked = firstKickoff ? firstKickoff <= new Date() : false;

  const { data: rawMatches } = await admin
    .from('knockout_matches')
    .select(`
      id, round, slot, kickoff_at, status, winner_team_id,
      home_team:home_team_id(id, name, code, flag_url),
      away_team:away_team_id(id, name, code, flag_url)
    `)
    .order('round', { ascending: true })
    .order('slot', { ascending: true });

  const matches: KnockoutMatchWithTeams[] = ((rawMatches ?? []) as unknown as RawMatch[]).map((m) => ({
    id: m.id,
    round: m.round,
    slot: m.slot,
    kickoffAt: m.kickoff_at,
    status: m.status as KnockoutMatchWithTeams['status'],
    winnerTeamId: m.winner_team_id,
    homeTeam: m.home_team
      ? { id: m.home_team.id, name: m.home_team.name, code: m.home_team.code, flagUrl: m.home_team.flag_url }
      : null,
    awayTeam: m.away_team
      ? { id: m.away_team.id, name: m.away_team.name, code: m.away_team.code, flagUrl: m.away_team.flag_url }
      : null,
  }));

  const existingScorePicks: Record<string, { homeGoals: number | null; awayGoals: number | null }> = {};
  if (userId) {
    const { data: picksData } = await admin
      .from('bracket_picks')
      .select('round, slot, home_goals, away_goals')
      .eq('user_id', userId)
      .eq('is_submitted', true);

    for (const p of picksData ?? []) {
      existingScorePicks[`${p.round}-${p.slot}`] = {
        homeGoals: p.home_goals ?? null,
        awayGoals: p.away_goals ?? null,
      };
    }
  }

  const hasSubmitted = userId ? Object.keys(existingScorePicks).length > 0 : false;
  const allFinished = matches.length > 0 && matches.every((m) => m.status === 'finished');

  let bracketState: BracketState;
  if (!bracketLocked) {
    bracketState = 'available_for_picks';
  } else if (allFinished) {
    bracketState = 'completed';
  } else {
    bracketState = hasSubmitted ? 'results_revealing' : 'picks_locked';
  }

  return { bracketState, matches, existingScorePicks };
}

export default async function KnockoutPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  let bracketState: BracketState = 'locked_pending_groups';
  let matches: KnockoutMatchWithTeams[] = [];
  let existingScorePicks: Record<string, { homeGoals: number | null; awayGoals: number | null }> = {};
  let error: string | null = null;

  try {
    ({ bracketState, matches, existingScorePicks } = await getBracketData(user?.id ?? null));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro ao carregar mata-mata';
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-green)' }}>Mata-Mata</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Seu bracket da Copa 2026</p>
      </div>
      {error ? (
        <div className="text-center py-12">
          <p style={{ color: 'var(--text-secondary)' }}>Erro: {error}</p>
        </div>
      ) : (
        <KnockoutClient
          matches={matches}
          existingScorePicks={existingScorePicks}
          bracketState={bracketState}
          userId={user?.id ?? ''}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: zero type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/knockout/page.tsx
git commit -m "feat: update knockout page to fetch and pass score picks"
```

---

## Task 6: Update Submit API

**Files:**
- Modify: `src/app/api/bracket/submit/route.ts`
- Modify: `src/app/api/bracket/submit/route.test.ts`

**Changes:**
- `PickInput` gains `homeGoals: number; awayGoals: number`.
- Validate no draws: `homeGoals !== awayGoals` for every pick.
- Store `home_goals`, `away_goals` in the insert rows.
- The existing available-match dynamic validation (from the previous bugfix session) remains.

- [ ] **Step 1: Update the failing tests**

```ts
// src/app/api/bracket/submit/route.test.ts
// Replace / extend the existing test file with these tests.
// Run: npx vitest run src/app/api/bracket/submit/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase admin
const mockAdmin = {
  from: vi.fn(),
};
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdmin }));

// Mock auth
vi.mock('@/lib/auth', () => ({
  COOKIE_NAME: 'auth',
  verifyToken: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => ({ value: 'token' }) }),
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/bracket/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeValidPick(round: number, slot: number, overrides?: Partial<{ teamId: string; homeGoals: number; awayGoals: number }>) {
  return { round, slot, teamId: `team-${round}-${slot}`, homeGoals: 2, awayGoals: 1, ...overrides };
}

// 16 R32 picks (no draws)
function makeR32Picks() {
  return Array.from({ length: 16 }, (_, i) => makeValidPick(5, i));
}

beforeEach(() => {
  vi.clearAllMocks();
});

function setupMocks({ existingPicks = [], availableMatches = makeR32Picks().map(p => ({ round: p.round, slot: p.slot })), firstKickoff = null }: {
  existingPicks?: unknown[];
  availableMatches?: Array<{ round: number; slot: number }>;
  firstKickoff?: string | null;
} = {}) {
  mockAdmin.from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    then: undefined,
    // Return different data depending on chain
    ...(table === 'bracket_picks' && { data: existingPicks, error: null }),
    ...(table === 'knockout_matches' && {
      data: firstKickoff ? [{ kickoff_at: firstKickoff }] : availableMatches,
      count: availableMatches.length,
      error: null,
    }),
  }));
}

describe('POST /api/bracket/submit', () => {
  it('rejects a draw pick', async () => {
    setupMocks();
    // Override: one pick is a draw
    const picks = makeR32Picks();
    picks[0] = makeValidPick(5, 0, { homeGoals: 1, awayGoals: 1 });

    // We need to make the available-matches mock return 16 slots
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'bracket_picks') {
        return { select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }) }) };
      }
      if (table === 'knockout_matches') {
        // First call: available matches; second call: first kickoff
        let callCount = 0;
        return {
          select: () => ({
            not: () => ({
              not: () => ({
                then: undefined,
                data: makeR32Picks().map(p => ({ round: p.round, slot: p.slot })),
                error: null,
              }),
              eq: () => ({
                not: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }),
              }),
            }),
            eq: () => ({
              not: () => ({
                not: () => ({
                  data: makeR32Picks().map(p => ({ round: p.round, slot: p.slot })),
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await POST(makeRequest({ picks }));
    // draw validation should reject
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empate/i);
  });

  it('rejects empty picks array', async () => {
    const res = await POST(makeRequest({ picks: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects non-array picks', async () => {
    const res = await POST(makeRequest({ picks: 'bad' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — expect draw test to FAIL (route doesn't validate draws yet)**

```bash
npx vitest run src/app/api/bracket/submit/route.test.ts
```

- [ ] **Step 3: Update route.ts**

Replace the `PickInput` interface and add draw validation + score storage:

```ts
// src/app/api/bracket/submit/route.ts
// (full file — replaces existing)
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface PickInput {
  round: number;
  slot: number;
  teamId: string;
  homeGoals: number;
  awayGoals: number;
}

export async function POST(request: Request) {
  // 1. Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 2. Check already submitted
  const { data: existing } = await admin
    .from('bracket_picks')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_submitted', true)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ alreadySubmitted: true }, { status: 409 });
  }

  // 3. Parse body
  let body: { picks?: PickInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const picks = body?.picks;
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'Picks inválidos' }, { status: 400 });
  }

  // 4. Validate no draws
  for (const pick of picks) {
    if (pick.homeGoals === pick.awayGoals) {
      return NextResponse.json(
        { error: `Empate não permitido no mata-mata (rodada ${pick.round}, slot ${pick.slot})` },
        { status: 400 },
      );
    }
  }

  // 5. Validate slot coverage against what's actually populated in the DB
  const { data: availableMatches } = await admin
    .from('knockout_matches')
    .select('round, slot')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);

  const expectedByRound = new Map<number, Set<number>>();
  for (const m of availableMatches ?? []) {
    if (!expectedByRound.has(m.round)) expectedByRound.set(m.round, new Set());
    expectedByRound.get(m.round)!.add(m.slot);
  }

  const totalRequired = (availableMatches ?? []).length;
  if (picks.length !== totalRequired) {
    return NextResponse.json(
      { error: `Envie exatamente ${totalRequired} picks` },
      { status: 400 },
    );
  }

  for (const [round, slots] of expectedByRound) {
    const roundPicks = picks.filter((p) => p.round === round);
    if (roundPicks.length !== slots.size) {
      return NextResponse.json(
        { error: `Rodada ${round}: esperado ${slots.size} picks, recebido ${roundPicks.length}` },
        { status: 400 },
      );
    }
    for (const slot of slots) {
      if (!roundPicks.some((p) => p.slot === slot)) {
        return NextResponse.json(
          { error: `Rodada ${round}: slot ${slot} não preenchido` },
          { status: 400 },
        );
      }
    }
  }

  // 6. Check bracket not locked (first R32 match hasn't started)
  const { data: firstR32 } = await admin
    .from('knockout_matches')
    .select('kickoff_at')
    .eq('round', 5)
    .not('kickoff_at', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1);

  if (firstR32?.[0]?.kickoff_at) {
    const firstKickoff = new Date(firstR32[0].kickoff_at);
    if (firstKickoff <= new Date()) {
      return NextResponse.json(
        { error: 'Bracket travado — primeiro jogo já começou' },
        { status: 409 },
      );
    }
  }

  // 7. Insert picks with scores
  const submittedAt = new Date().toISOString();
  const rows = picks.map((p) => ({
    user_id: user.id,
    round: p.round,
    slot: p.slot,
    team_id: p.teamId,
    home_goals: p.homeGoals,
    away_goals: p.awayGoals,
    is_submitted: true,
    submitted_at: submittedAt,
  }));

  const { error: insertError } = await admin.from('bracket_picks').insert(rows);

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ alreadySubmitted: true }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests — expect to pass**

```bash
npx vitest run src/app/api/bracket/submit/route.test.ts
```

- [ ] **Step 5: Full build**

```bash
npm run build
```

Expected: zero type errors, compiled successfully.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bracket/submit/route.ts src/app/api/bracket/submit/route.test.ts
git commit -m "feat: update submit API to accept and store score-based bracket picks"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Score input (home/away goals) like group stage | Task 3 — BracketScoreCard |
| Subsequent rounds derived from user's predicted winners | Tasks 2 + 4 — bracketLogic + KnockoutClient |
| DB migration for home_goals/away_goals | Task 1 |
| Submit API accepts scores, derives team_id | Task 6 |
| No draws allowed | Task 6 (API) + Task 3 (UI — winner only highlights when goals differ) |
| Scoring cron unaffected | ✓ team_id still stored as winner |
| Draft persistence in localStorage | Task 4 — KnockoutClient |
| Round tabs still work | Task 4 — roundPickCount / roundTotal |
| Locked state shows submitted picks | Task 4 — locked=true renders text not inputs |

### Potential gaps

- **RoundTab `total` prop for rounds 6-9:** When R16/QF/SF/Final have no teams yet (derived teams null), `roundTotal(round) === 0`. The tab shows `0/0`. This is intentional — as user fills R32 picks, R16 totals start appearing. No fix needed.
- **Existing `bracket_picks` rows without home_goals/away_goals:** If any user submitted with the old click-based system, their picks have null scores. On the page, `existingScorePicks` entries will have `homeGoals: null, awayGoals: null`, and `submitted` initializes to `true` but `scorePicks` is empty. The locked view shows `–` for their scores. Acceptable edge case — the old system was broken anyway.
- **`divideColor` via inline `style`:** Tailwind's `divide-y` and inline `style={{ divideColor: ... }}` don't compose. For the `<hr>`-like divider between team rows, add a `border-t` class on the second `TeamRow` wrapper instead, using `style={{ borderColor: 'var(--border-color)' }}`. Fix this in Task 3 Step 1 if not already handled — the current implementation uses `divide-y` on the card wrapper which needs `--tw-divide-color` via class not inline style.
