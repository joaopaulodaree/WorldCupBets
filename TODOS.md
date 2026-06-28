# TODOS

Deferred from `/plan-eng-review` on 2026-06-27 (mata-mata feature).

---

## TODO-1: Migrar leaderboard para SQL GROUP BY

**What:** Substituir 3 round-trips + JS loops no `leaderboard/page.tsx:22-26` por 1 query SQL com GROUP BY user_id por tabela, depois join em JS.

**Why:** Elimina risco de timeout Vercel (10s) com volume maior; remove O(N) JS loops por tabela de prediction rows.

**Pros:** Mais performático, mais simples de ler, escala com mais usuários.

**Cons:** Requer refatorar a lógica de aggregation (atualmente funciona bem para volume atual).

**Context:** A query atual faz `select('user_id, points')` em `predictions`, `bracket_picks` e `group_position_points` separadamente e agrega em JavaScript. Aceito para V1 (grupo de amigos), mas pode atingir timeout com 50+ usuários e histórico de predictions crescendo. Ponto de entrada: `src/app/(app)/leaderboard/page.tsx:9` — função `getLeaderboard`.

**Depends on / blocked by:** Mata-mata feature completa (precisa das 3 tabelas existindo).

---

## TODO-2: Delta arrows (▲▼) refletir bracket_pts e grupo_pts

**What:** Fazer os crons `sync-group-points` e `sync-bracket-points` também escriberem `leaderboard_snapshots` ao final, para que mudanças de posição por bracket ou grupo disparem delta arrows.

**Why:** Atualmente delta arrows (▲▼) no leaderboard só atualizam quando `sync-results` roda (resultado de jogo). Mudanças de rank por bracket ou grupo não atualizam as setas até o próximo jogo.

**Pros:** Leaderboard mais preciso e reativo após bracket points calculados.

**Cons:** Requer extrair snapshot-write logic para função reutilizável (atualmente inline em sync-results). ~1h de trabalho.

**Context:** `leaderboard_snapshots` é escrito em `src/app/api/cron/sync-results/route.ts` após calcular pontos de jogos. Os novos crons precisariam chamar a mesma lógica. Aceito como V1 gap — delta por total rank ainda funciona.

**Depends on / blocked by:** sync-group-points e sync-bracket-points implementados.

---

## TODO-3: E2E test — fluxo completo bracket

**What:** Playwright test cobrindo: abrir /knockout → preencher 31 picks → confirmar bracket → verificar cards ficam verdes/vermelhos conforme `winner_team_id` é populado.

**Why:** É o fluxo mais crítico do usuário na feature mata-mata. Unit tests cobrem lógica de API mas não o fluxo UI completo.

**Pros:** Garante que o reveal progressivo (verde/vermelho) funciona corretamente de ponta a ponta.

**Cons:** ~3h para setup Playwright + escrever o teste. Requer mock de knockout_matches com winner_team_id ou ambiente de staging.

**Context:** Vitest cobre os endpoints de API (bracket/submit, sync-group-points, sync-bracket-points). O gap E2E fica no componente KnockoutClient + BracketCard + estado `results_revealing`. Ponto de entrada: `src/components/knockout/KnockoutClient.tsx`.

**Depends on / blocked by:** Mata-mata feature completa e Vitest setup (TODO não-deferred, está no Step 0.0).
