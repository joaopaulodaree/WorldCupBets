# Tasks: Predictions

## T-PRED-01 — Schema do banco: predictions
**O quê:** Criar tabela `predictions` com unique constraint (user_id, match_id) e RLS
**Onde:** Supabase migrations
**Depende de:** T-MATCH-01, T-AUTH-02
**Refs:** PRED-001, PRED-004
**Done when:** RLS garante que usuário só lê/escreve seus próprios palpites; unique constraint ativo
**Gate:** Tentar inserir palpite duplicado via SQL retorna erro

## T-PRED-02 — API Route de palpites (upsert)
**O quê:** `POST /api/predictions` valida autenticação, verifica trava temporal, faz upsert no banco
**Onde:** `src/app/api/predictions/route.ts`
**Depende de:** T-PRED-01
**Refs:** PRED-001, PRED-002, PRED-005, PRED-007
**Done when:** Salva palpite se partida não iniciou; retorna 403 se partida já começou
**Gate:** Teste com horário mockado pré e pós kickoff

## T-PRED-03 — Lógica de scoring
**O quê:** Função `calculatePoints(prediction, result)` pura: exato=3, vencedor=1, erro=0
**Onde:** `src/lib/scoring.ts`
**Depende de:** —
**Refs:** LB-002, PRED-010
**Done when:** Unit tests cobrem: acerto exato, acerto vencedor casa, acerto vencedor fora, acerto empate errado, erro total
**Gate:** `npm test src/lib/scoring.test.ts` passa

## T-PRED-04 — Integrar scoring no cron
**O quê:** Após atualizar resultado de uma partida, calcular e salvar `points` em todas as predictions daquela partida
**Onde:** `src/app/api/cron/sync-results/route.ts`
**Depende de:** T-MATCH-04, T-PRED-01, T-PRED-03
**Refs:** LB-003
**Done when:** Após cron rodar para partida encerrada, todas as predictions têm `points` preenchido
**Gate:** Verificar banco após cron manual

## T-PRED-05 — Componente PredictionForm
**O quê:** Inputs numéricos para placar, botão salvar, estado travado (cadeado) quando partida iniciou
**Onde:** `src/components/match/PredictionForm.tsx`
**Depende de:** T-UI-03, T-PRED-02
**Refs:** PRED-001, PRED-003, PRED-005, PRED-006
**Done when:** Form salva palpite via API Route; exibe cadeado quando `now() >= kickoff_at`
**Gate:** Teste de trava: mudar relógio do sistema para após kickoff → form travado

## T-PRED-06 — Exibição de resultado e pontos no MatchCard
**O quê:** Após partida encerrada, exibir resultado real ao lado do palpite e badge colorido com pontos
**Onde:** `src/components/match/MatchCard.tsx`, `src/components/match/PredictionResult.tsx`
**Depende de:** T-MATCH-05, T-PRED-04
**Refs:** PRED-010, PRED-013
**Done when:** Card de partida encerrada exibe "Seu palpite: 2x1 | Resultado: 3x0 | +1 pt" com badge amarelo
**Gate:** Visual check com dados mockados para os 3 resultados (verde/amarelo/vermelho)
