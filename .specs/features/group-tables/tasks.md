# Tasks: Group Tables

## T-GT-01 — Função de cálculo da tabela de grupos
**O quê:** `calculateGroupTable(matches, userPredictions?)` retorna array de seleções ordenadas por pontos/saldo/gols/nome
**Onde:** `src/lib/group-table.ts`
**Depende de:** —
**Refs:** GT-001, GT-007, GT-008, GT-013
**Done when:** Unit tests cobrem: seleção com 9 pts primeiro, desempate por saldo, partida sem palpite = 0x0
**Gate:** `npm test src/lib/group-table.test.ts` passa

## T-GT-02 — Componente GroupTable
**O quê:** Tabela visual: posição, bandeira, nome, J, V, E, D, GP, GC, SG, PTS. Destaque para top 2 (classificados)
**Onde:** `src/components/group/GroupTable.tsx`
**Depende de:** T-UI-03, T-GT-01
**Refs:** GT-001, GT-002, GT-012
**Done when:** Tabela exibe todas as colunas; 1º e 2º têm borda/cor verde de classificado
**Gate:** Visual check com dados mockados de um grupo completo

## T-GT-03 — Página de grupos: tabela real vs simulada
**O quê:** Server Component busca partidas + resultados (real) e palpites do usuário (simulada), renderiza dois GroupTable lado a lado com GroupSelector (tabs A-H)
**Onde:** `src/app/(app)/groups/page.tsx`, `src/components/group/GroupSelector.tsx`
**Depende de:** T-GT-02, T-PRED-01, T-MATCH-02
**Refs:** GT-003, GT-005, GT-009, GT-010, GT-011
**Done when:** Página `/groups` mostra tabs A-H; cada tab exibe tabela real e tabela simulada do usuário
**Gate:** Usuário sem palpites vê tabela simulada com todos em empate (0x0); com palpites vê projeção correta
