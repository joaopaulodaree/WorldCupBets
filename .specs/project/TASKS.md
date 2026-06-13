# WorldCupBets — Master Task List

## Legenda
- ⬜ Não iniciado
- 🔄 Em progresso
- ✅ Concluído
- 🚫 Bloqueado

---

## M1 — Foundation

| ID | Task | Depende de | Status |
|----|------|-----------|--------|
| T-AUTH-01 | Setup Next.js 14 + TypeScript + Tailwind + Supabase client | — | ⬜ |
| T-UI-01 | Tema Tailwind: verde/amarelo dark mode | T-AUTH-01 | ⬜ |
| T-UI-03 | Componentes UI primitivos (Button, Card, Badge, Skeleton, Toast) | T-UI-01 | ⬜ |
| T-AUTH-02 | Schema banco: profiles + RLS | T-AUTH-01 | ⬜ |
| T-AUTH-03 | Middleware de proteção de rotas | T-AUTH-01 | ⬜ |
| T-AUTH-04 | Página de cadastro | T-AUTH-01, T-AUTH-02 | ⬜ |
| T-AUTH-05 | Página de login | T-AUTH-01 | ⬜ |
| T-AUTH-06 | Botão de logout | T-AUTH-03 | ⬜ |
| T-UI-02 | Layout shell (Header, BottomNav, Sidebar) | T-UI-01, T-AUTH-03 | ⬜ |
| T-UI-04 | Configuração PWA | T-UI-01 | ⬜ |

---

## M2 — Match Data

| ID | Task | Depende de | Status |
|----|------|-----------|--------|
| T-MATCH-01 | Schema banco: teams + matches | T-AUTH-01 | ⬜ |
| T-MATCH-03 | Cliente API-Football | T-AUTH-01 | ⬜ |
| T-MATCH-02 | Seed: 32 seleções + 48 partidas | T-MATCH-01 | ⬜ |
| T-MATCH-05 | Componente MatchCard | T-UI-03 | ⬜ |
| T-MATCH-04 | Cron job sync-results | T-MATCH-01, T-MATCH-03 | ⬜ |
| T-MATCH-06 | Página de partidas agrupadas | T-MATCH-02, T-MATCH-05, T-UI-02 | ⬜ |

---

## M3 — Predictions

| ID | Task | Depende de | Status |
|----|------|-----------|--------|
| T-PRED-03 | Lógica de scoring (unit testada) | — | ⬜ |
| T-PRED-01 | Schema banco: predictions | T-MATCH-01, T-AUTH-02 | ⬜ |
| T-PRED-02 | API Route de palpites (upsert + trava) | T-PRED-01 | ⬜ |
| T-PRED-05 | Componente PredictionForm | T-UI-03, T-PRED-02 | ⬜ |
| T-PRED-04 | Integrar scoring no cron | T-MATCH-04, T-PRED-01, T-PRED-03 | ⬜ |
| T-PRED-06 | Exibição resultado + badge no MatchCard | T-MATCH-05, T-PRED-04 | ⬜ |

---

## M4 — Group Tables

| ID | Task | Depende de | Status |
|----|------|-----------|--------|
| T-GT-01 | Função calculateGroupTable (unit testada) | — | ⬜ |
| T-GT-02 | Componente GroupTable | T-UI-03, T-GT-01 | ⬜ |
| T-GT-03 | Página grupos: real vs simulada | T-GT-02, T-PRED-01, T-MATCH-02 | ⬜ |

---

## M5 — Leaderboard & Scoring

| ID | Task | Depende de | Status |
|----|------|-----------|--------|
| T-LB-01 | Schema banco: leaderboard_snapshots | T-AUTH-02 | ⬜ |
| T-LB-02 | Query leaderboard com variação de posição | T-PRED-04, T-LB-01 | ⬜ |
| T-LB-03 | Integrar snapshot no cron | T-LB-01, T-LB-02, T-PRED-04 | ⬜ |
| T-LB-04 | Componente LeaderboardTable | T-UI-03, T-LB-02 | ⬜ |
| T-LB-05 | Página do leaderboard | T-LB-04 | ⬜ |

---

## M6 — Polish & Launch

| ID | Task | Depende de | Status |
|----|------|-----------|--------|
| T-POLISH-01 | Animações Framer Motion (transições, cards, leaderboard) | M5 completo | ⬜ |
| T-POLISH-02 | Revisão de responsividade completa (375px → 1440px) | M5 completo | ⬜ |
| T-POLISH-03 | Testes de integração críticos (auth, palpite, scoring) | M5 completo | ⬜ |
| T-POLISH-04 | Deploy Vercel + variáveis de ambiente | T-AUTH-01 | ⬜ |
| T-POLISH-05 | Configurar Vercel Cron em produção | T-MATCH-04, T-POLISH-04 | ⬜ |

---

## Resumo

| Milestone | Tasks | Estimativa |
|-----------|-------|-----------|
| M1 Foundation | 10 | ~1 sessão |
| M2 Match Data | 6 | ~1 sessão |
| M3 Predictions | 6 | ~1 sessão |
| M4 Group Tables | 3 | ~0.5 sessão |
| M5 Leaderboard | 5 | ~1 sessão |
| M6 Polish | 5 | ~1 sessão |
| **Total** | **35** | **~6 sessões** |
