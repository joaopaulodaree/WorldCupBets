# Feature: Match Data — Dados das Partidas

## Objetivo
Importar e manter atualizados os dados das partidas da Copa do Mundo 2026 (fase de grupos) via API-Football, armazenando-os no banco local para consulta rápida.

## Requisitos

### Modelo de dados
- **MATCH-001** Cada Partida armazena: id externo (API-Football), grupo, rodada, horário UTC, seleção da casa, seleção visitante, status (agendada | em andamento | encerrada), gols da casa, gols visitante
- **MATCH-002** Cada Seleção armazena: nome, código ISO (BRA, ARG…), URL da bandeira

### Sincronização
- **MATCH-003** Um job de sincronização busca os resultados das partidas encerradas na API-Football e atualiza o banco
- **MATCH-004** O job roda via Vercel Cron a cada 5 minutos durante o período da Copa
- **MATCH-005** Partidas não iniciadas e sem resultado não são atualizadas desnecessariamente (economiza requests)
- **MATCH-006** O seed inicial das 48 partidas (grupos, horários, seleções) pode ser feito manualmente ou via script, pois a Copa ainda não começou

### Exibição
- **MATCH-007** As partidas são exibidas agrupadas por grupo (A, B, C… H) e por rodada (1ª, 2ª, 3ª rodada)
- **MATCH-008** Cada partida exibe: bandeiras das seleções, nomes, horário local do usuário, status e resultado quando encerrada
- **MATCH-009** Partidas em andamento exibem indicador visual destacado ("AO VIVO")
- **MATCH-010** O status da partida é derivado do horário: agendada se no futuro, encerrada se resultado no banco

## Notas de implementação
- API-Football endpoint: `GET /fixtures?league=1&season=2026` (FIFA World Cup)
- Free tier: 100 requests/dia — suficiente para o período da Copa com cron a cada 5 min apenas durante jogos
- Otimização: só rodar sync quando há partidas "em andamento" ou "iniciando nas próximas 2h"
- Bandeiras: usar API-Football ou CDN de flags (flagcdn.com)

## Critério de aceite
Lista de partidas da fase de grupos visível no app, agrupada por grupo. Após o fim de um jogo real, o resultado aparece automaticamente em até 5 minutos.
