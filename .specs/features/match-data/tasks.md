# Tasks: Match Data

## T-MATCH-01 — Schema do banco: teams + matches
**O quê:** Criar tabelas `teams` e `matches` com RLS (leitura pública)
**Onde:** Supabase migrations
**Depende de:** T-AUTH-01
**Refs:** MATCH-001, MATCH-002
**Done when:** Tabelas criadas, RLS permite SELECT para todos, nega INSERT/UPDATE do cliente
**Gate:** Query via Supabase Studio retorna dados

## T-MATCH-02 — Seed das seleções e partidas da fase de grupos
**O quê:** Script TypeScript que popula `teams` (32 seleções) e `matches` (48 jogos com grupos, horários, seleções)
**Onde:** `scripts/seed-matches.ts`
**Depende de:** T-MATCH-01
**Refs:** MATCH-006
**Done when:** 48 partidas inseridas com grupos corretos e horários UTC
**Gate:** Query `SELECT count(*) FROM matches` = 48

## T-MATCH-03 — Cliente API-Football
**O quê:** Wrapper TypeScript para a API-Football com tipos e rate limiting básico
**Onde:** `src/lib/api-football/client.ts`
**Depende de:** T-AUTH-01
**Refs:** MATCH-003
**Done when:** `getFixtureResult(externalId)` retorna { homeGoals, awayGoals, status }
**Gate:** Teste manual com fixture ID real da API

## T-MATCH-04 — Cron job de sincronização de resultados
**O quê:** `/api/cron/sync-results` busca partidas não encerradas próximas ao horário, chama API-Football, atualiza banco
**Onde:** `src/app/api/cron/sync-results/route.ts`, `vercel.json`
**Depende de:** T-MATCH-01, T-MATCH-03
**Refs:** MATCH-003, MATCH-004, MATCH-005
**Done when:** Cron atualiza status de `live` → `finished` com placar correto
**Gate:** Testar manualmente com fixture encerrada da API-Football

## T-MATCH-05 — Componente MatchCard
**O quê:** Card visual de partida: bandeiras, nomes, horário local, status, placar quando encerrado
**Onde:** `src/components/match/MatchCard.tsx`
**Depende de:** T-UI-03
**Refs:** MATCH-007, MATCH-008, MATCH-009
**Done when:** Card exibe corretamente partida agendada, em andamento (badge "AO VIVO") e encerrada
**Gate:** Visual check com dados mockados nos 3 estados

## T-MATCH-06 — Página de partidas agrupadas por grupo
**O quê:** Server Component que busca partidas do banco, agrupa por grupo e rodada, renderiza lista
**Onde:** `src/app/(app)/matches/page.tsx`
**Depende de:** T-MATCH-02, T-MATCH-05, T-UI-02
**Refs:** MATCH-007, MATCH-010
**Done when:** Página `/matches` exibe 48 partidas agrupadas por grupo (A-H) e rodada (1-3)
**Gate:** Visual check com dados reais do seed
