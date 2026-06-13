# Feature: Leaderboard — Ranking dos Usuários

## Objetivo
Exibir o ranking competitivo de todos os usuários do bolão, ordenado por pontuação total, com variação de posição após cada rodada de jogos.

## Requisitos

### Pontuação
- **LB-001** A pontuação de cada usuário é a soma dos pontos de todos os seus palpites avaliados
- **LB-002** Regras de scoring (D-007): placar exato = 3 pts, vencedor correto ou empate com placar errado = 1 pt, erro = 0 pts
- **LB-003** A pontuação é recalculada automaticamente quando novos resultados oficiais são inseridos
- **LB-004** Palpites de partidas não encerradas não contam para a pontuação

### Ranking
- **LB-005** O leaderboard exibe todos os usuários ordenados por pontuação decrescente
- **LB-006** Em caso de empate de pontos, a ordem é alfabética pelo nome de exibição
- **LB-007** Cada linha exibe: posição atual, nome do usuário, pontuação total, variação de posição
- **LB-008** O usuário logado tem sua linha destacada visualmente (mesmo que esteja no meio da lista)
- **LB-009** Variação de posição: ↑N (subiu N posições), ↓N (desceu N posições), = (mesma posição), NOVO (primeiro jogo pontuado)

### Snapshot de posições
- **LB-010** A variação é calculada comparando a posição atual com a posição antes da última rodada de jogos encerrados
- **LB-011** Um snapshot das posições é salvo no banco após cada partida ser encerrada e o scoring processado
- **LB-012** Se não há snapshot anterior para um usuário, exibe "NOVO"

### Atualização
- **LB-013** O leaderboard reflete pontuações atualizadas em até 5 minutos após o fim de uma partida (junto com o cron de resultados)
- **LB-014** Não é necessário realtime websocket — revalidação de cache do Next.js é suficiente

## Notas de implementação
- Tabela `leaderboard_snapshots`: user_id, position, points, snapshot_at
- View materializada ou query calculada em tempo real (48 partidas, N usuários — query direta é suficiente)
- Pontuação pode ser armazenada em coluna calculada ou view no Supabase
- Highlight da linha do usuário logado via comparação de user_id no Server Component

## Critério de aceite
Após um jogo encerrar, João que acertou o placar exato aparece com +3 pts e ↑2 posições. Maria que errou tudo aparece com 0 pts novos e ↓1. O usuário logado vê sua própria linha destacada independente da posição.
