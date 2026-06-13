# Tasks: Leaderboard

## T-LB-01 — Schema do banco: leaderboard_snapshots
**O quê:** Criar tabela `leaderboard_snapshots` com RLS (leitura pública, sem escrita cliente)
**Onde:** Supabase migrations
**Depende de:** T-AUTH-02
**Refs:** LB-010, LB-011
**Done when:** Tabela criada; RLS permite SELECT para todos
**Gate:** Query via Studio retorna dados após insert manual

## T-LB-02 — Query do leaderboard com variação de posição
**O quê:** Query/função que retorna usuários ordenados por pontos + posição anterior do último snapshot
**Onde:** `src/lib/leaderboard.ts` (ou Supabase view/function)
**Depende de:** T-PRED-04, T-LB-01
**Refs:** LB-001, LB-005, LB-006, LB-009
**Done when:** Retorna array `{ userId, displayName, totalPoints, currentPosition, previousPosition, delta }`
**Gate:** Teste manual com 3 usuários e pontuações distintas

## T-LB-03 — Integrar snapshot no cron
**O quê:** Após processar scoring de uma partida, inserir snapshot das posições atuais no banco
**Onde:** `src/app/api/cron/sync-results/route.ts`
**Depende de:** T-LB-01, T-LB-02, T-PRED-04
**Refs:** LB-010, LB-011, LB-013
**Done when:** Após cron, nova linha em `leaderboard_snapshots` com posições de todos os usuários
**Gate:** Verificar banco após cron manual com 2+ usuários com palpites

## T-LB-04 — Componente LeaderboardTable
**O quê:** Tabela de ranking: posição, nome, pontos, variação (↑2, ↓1, =, NOVO). Destaque na linha do usuário logado
**Onde:** `src/components/leaderboard/LeaderboardTable.tsx`, `src/components/leaderboard/RankRow.tsx`
**Depende de:** T-UI-03, T-LB-02
**Refs:** LB-007, LB-008, LB-009
**Done when:** Linha do usuário logado tem fundo destacado; variação exibe corretamente em todos os casos
**Gate:** Visual check com dados mockados cobrindo todos os estados de delta

## T-LB-05 — Página do leaderboard
**O quê:** Server Component que busca e renderiza o leaderboard completo
**Onde:** `src/app/(app)/leaderboard/page.tsx`
**Depende de:** T-LB-04
**Refs:** LB-013, LB-014
**Done when:** Página `/leaderboard` carrega e exibe ranking completo com usuário logado destacado
**Gate:** Verificar com 2+ usuários com pontuações diferentes
