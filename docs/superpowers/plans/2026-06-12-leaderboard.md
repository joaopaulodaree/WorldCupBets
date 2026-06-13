# Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o leaderboard com ranking por pontos, variação de posição por partida, e snapshot persistido no cron.

**Architecture:** Cada vez que o cron processa uma partida finalizada, ele calcula os pontos dos palpites e grava um snapshot do ranking em `leaderboard_snapshots`. A página de leaderboard computa o ranking atual (live, via SUM de predictions.points) e compara com o segundo snapshot mais recente para exibir o delta (↑↓).

**Tech Stack:** Next.js 15 (Server Components), Supabase (admin client), TypeScript, Tailwind CSS

---

## File Map

| Arquivo | Ação |
|---|---|
| `supabase/migrations/20260612000004_leaderboard_snapshots.sql` | Criar |
| `src/app/api/cron/sync-results/route.ts` | Modificar (adicionar snapshot após calcPoints) |
| `src/components/leaderboard/LeaderboardRow.tsx` | Criar |
| `src/app/(app)/leaderboard/page.tsx` | Substituir (era placeholder) |

---

## Task 1: Migration — tabela leaderboard_snapshots

**Files:**
- Create: `supabase/migrations/20260612000004_leaderboard_snapshots.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
CREATE TABLE public.leaderboard_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position   smallint NOT NULL,
  points     smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX idx_leaderboard_snapshots_match ON public.leaderboard_snapshots(match_id);
CREATE INDEX idx_leaderboard_snapshots_user ON public.leaderboard_snapshots(user_id);
```

- [ ] **Step 2: Commitar migration**

```bash
git add supabase/migrations/20260612000004_leaderboard_snapshots.sql
git commit -m "feat: add leaderboard_snapshots migration"
```

---

## Task 2: Cron — gravar snapshot após cada partida finalizada

**Files:**
- Modify: `src/app/api/cron/sync-results/route.ts`

O cron já calcula pontos com `calcPoints`. Após atualizar os palpites de uma partida finalizada, adicionamos a lógica de snapshot.

- [ ] **Step 1: Adicionar função saveLeaderboardSnapshot após o bloco de calcPoints**

No final do bloco `if (result.status === 'finished' ...)`, após o loop de update de predictions, adicionar:

```typescript
// Snapshot: aggregate all scored predictions and rank users
const { data: allScored } = await supabase
  .from('predictions')
  .select('user_id, points')
  .not('points', 'is', null);

const totals = new Map<string, number>();
for (const p of allScored ?? []) {
  totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
}

const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
const snapshots = sorted.map(([userId, pts], i) => ({
  match_id: match.id,
  user_id: userId,
  position: i + 1,
  points: pts,
}));

if (snapshots.length > 0) {
  await supabase
    .from('leaderboard_snapshots')
    .upsert(snapshots, { onConflict: 'match_id,user_id' });
}
```

- [ ] **Step 2: Commitar**

```bash
git add src/app/api/cron/sync-results/route.ts
git commit -m "feat: save leaderboard snapshot after each finished match"
```

---

## Task 3: Componente LeaderboardRow

**Files:**
- Create: `src/components/leaderboard/LeaderboardRow.tsx`

- [ ] **Step 1: Criar componente**

```tsx
export type LeaderboardEntry = {
  position: number;
  name: string;
  points: number;
  delta: number | null; // positive = moved up, negative = moved down, null = debut
  isCurrentUser: boolean;
};

function PositionBadge({ position }: { position: number }) {
  const medals: Record<number, { emoji: string; color: string }> = {
    1: { emoji: '🥇', color: '#FFD700' },
    2: { emoji: '🥈', color: '#C0C0C0' },
    3: { emoji: '🥉', color: '#CD7F32' },
  };
  const medal = medals[position];
  if (medal) {
    return (
      <span className="text-xl leading-none" style={{ color: medal.color }}>
        {medal.emoji}
      </span>
    );
  }
  return (
    <span
      className="text-sm font-bold tabular-nums w-6 text-center"
      style={{ color: 'var(--text-tertiary)' }}
    >
      {position}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        —
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="text-xs font-semibold" style={{ color: 'var(--brand-green)' }}>
        ↑{delta}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>
      ↓{Math.abs(delta)}
    </span>
  );
}

export function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{
        background: 'var(--bg-card)',
        border: entry.isCurrentUser
          ? '1px solid var(--brand-green)'
          : '1px solid var(--border-color)',
        boxShadow: entry.isCurrentUser ? 'var(--glow-green)' : undefined,
      }}
    >
      <div className="w-8 flex items-center justify-center flex-shrink-0">
        <PositionBadge position={entry.position} />
      </div>

      <span className="flex-1 font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {entry.name}
        {entry.isCurrentUser && (
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--brand-green)' }}>
            (você)
          </span>
        )}
      </span>

      <span
        className="font-display text-lg tabular-nums flex-shrink-0"
        style={{ color: 'var(--brand-yellow)' }}
      >
        {entry.points}
        <span className="text-xs font-sans ml-0.5" style={{ color: 'var(--text-tertiary)' }}>
          pts
        </span>
      </span>

      <div className="w-8 text-right flex-shrink-0">
        <DeltaBadge delta={entry.delta} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commitar**

```bash
git add src/components/leaderboard/LeaderboardRow.tsx
git commit -m "feat: add LeaderboardRow component"
```

---

## Task 4: Página de Leaderboard (Server Component)

**Files:**
- Modify: `src/app/(app)/leaderboard/page.tsx`

A página segue o padrão de `matches/page.tsx`: Server Component que consulta o DB diretamente com admin client.

**Lógica de ranking:**
1. Buscar todos os `predictions` com `points IS NOT NULL`
2. Agregar `SUM(points)` por `user_id` em memória → ordenar DESC → atribuir posição
3. Buscar nomes dos usuários via `users` table
4. Buscar os dois `match_id` mais recentes com snapshots em `leaderboard_snapshots`
5. Buscar snapshot do segundo mais recente (= estado antes do último jogo processado)
6. Calcular `delta = prev_position - curr_position` (positivo = subiu)
7. Identificar o usuário logado via cookie/JWT para destacar na lista

- [ ] **Step 1: Implementar página**

```tsx
'use server';

import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { LeaderboardRow, type LeaderboardEntry } from '@/components/leaderboard/LeaderboardRow';

async function getLeaderboard(currentUserId: string | null): Promise<LeaderboardEntry[]> {
  const admin = createAdminClient();

  // 1. All scored predictions
  const { data: predData } = await admin
    .from('predictions')
    .select('user_id, points')
    .not('points', 'is', null);

  if (!predData?.length) return [];

  // 2. Aggregate points per user
  const totals = new Map<string, number>();
  for (const p of predData) {
    totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
  }

  // 3. Sort and assign current positions
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const userIds = sorted.map(([id]) => id);

  // 4. Fetch user names
  const { data: users } = await admin
    .from('users')
    .select('id, name')
    .in('id', userIds);
  const nameMap = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));

  // 5. Find two most recent distinct match_ids with snapshots
  const { data: snapRows } = await admin
    .from('leaderboard_snapshots')
    .select('match_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const seenMatchIds: string[] = [];
  const seen = new Set<string>();
  for (const s of snapRows ?? []) {
    if (!seen.has(s.match_id)) {
      seen.add(s.match_id);
      seenMatchIds.push(s.match_id);
      if (seenMatchIds.length === 2) break;
    }
  }
  // seenMatchIds[0] = most recent, seenMatchIds[1] = previous
  const prevMatchId = seenMatchIds[1] ?? null;

  // 6. Fetch previous snapshot positions
  const prevPositionMap = new Map<string, number>();
  if (prevMatchId) {
    const { data: prevSnaps } = await admin
      .from('leaderboard_snapshots')
      .select('user_id, position')
      .eq('match_id', prevMatchId);
    for (const s of prevSnaps ?? []) {
      prevPositionMap.set(s.user_id, s.position);
    }
  }

  // 7. Build result
  return sorted.map(([userId, points], i) => {
    const position = i + 1;
    const prevPosition = prevPositionMap.get(userId);
    const delta = prevPosition != null ? prevPosition - position : null;
    return {
      position,
      name: nameMap.get(userId) ?? 'Desconhecido',
      points,
      delta,
      isCurrentUser: userId === currentUserId,
    };
  });
}

export default async function LeaderboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  let entries: LeaderboardEntry[] = [];
  let error: string | null = null;

  try {
    entries = await getLeaderboard(user?.id ?? null);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro ao carregar ranking';
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-green mb-2">Ranking Global</h1>
        <p className="text-secondary">Quem está ganhando o bolão?</p>
      </div>

      {error ? (
        <div className="text-center py-12">
          <p className="text-secondary">Erro ao carregar ranking: {error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="text-2xl mb-3">⚽</p>
          <p className="text-secondary">Nenhum palpite pontuado ainda.</p>
          <p className="text-sm text-tertiary mt-1">
            O ranking aparecerá após o primeiro jogo ser encerrado.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <LeaderboardRow key={entry.position} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commitar**

```bash
git add src/app/(app)/leaderboard/page.tsx
git commit -m "feat: implement leaderboard page with position delta"
```

---

## Task 5: Commit geral do projeto

- [ ] **Step 1: Adicionar todos os arquivos não comitados**

```bash
git add -A
git status
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: initial project — matches, predictions, auth, leaderboard"
```
