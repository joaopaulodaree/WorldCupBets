# WorldCupBets — Roadmap

## Milestones

### M1 — Foundation
**Objetivo:** Projeto funcionando localmente com autenticação e banco configurado.

Features:
- `auth` — Cadastro e login com email/senha
- `ui-shell` — PWA setup, navegação, tema Brasil

Entregável: Usuário consegue se cadastrar, logar e ver a shell do app.

---

### M2 — Match Data
**Objetivo:** Partidas da fase de grupos visíveis no app com dados reais.

Features:
- `match-data` — Integração API-Football, seed de partidas no banco, sync de resultados

Entregável: Lista de partidas com horário, seleções, status e resultado oficial quando encerradas.

---

### M3 — Predictions
**Objetivo:** Usuários fazem e editam palpites antes de cada jogo.

Features:
- `predictions` — CRUD de palpites, trava automática no início da partida

Entregável: Usuário palpita Brasil 2x1 Marrocos, o palpite aparece salvo e trava quando o jogo começa.

---

### M4 — Group Tables
**Objetivo:** Duas tabelas de grupos lado a lado: real e simulada.

Features:
- `group-tables` — Cálculo da tabela real (API) e simulada (palpites do usuário)

Entregável: Usuário vê como os grupos ficam na realidade vs. como ficariam se seus palpites estivessem certos.

---

### M5 — Leaderboard & Scoring
**Objetivo:** Pontuação calculada e leaderboard competitivo.

Features:
- `leaderboard` — Engine de scoring, ranking com variação de posição

Entregável: Leaderboard mostra quem está na frente, quantos pontos tem, e se subiu ou desceu.

---

### M6 — Polish & Launch
**Objetivo:** App pronto para compartilhar com amigos.

- Animações com Framer Motion
- PWA instalável no celular
- Responsividade completa
- Testes de integração críticos
- Deploy na Vercel com domínio configurado

---

## Status

| Milestone | Status |
|-----------|--------|
| M1 — Foundation | ⬜ Não iniciado |
| M2 — Match Data | ⬜ Não iniciado |
| M3 — Predictions | ⬜ Não iniciado |
| M4 — Group Tables | ⬜ Não iniciado |
| M5 — Leaderboard & Scoring | ⬜ Não iniciado |
| M6 — Polish & Launch | ⬜ Não iniciado |
