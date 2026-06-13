# WorldCupBets — Glossário do Domínio

## Usuário
Pessoa cadastrada no app com nome de usuário e senha. Qualquer pessoa pode se cadastrar (registro aberto).

## Palpite
Previsão de placar exato que um Usuário faz para uma Partida (ex: Brasil 2 x 1 Marrocos). Um Palpite só pode ser criado ou editado antes do início da Partida.

## Partida
Jogo oficial da Copa do Mundo 2026. Possui horário de início, duas seleções, e um resultado oficial fornecido pela API de Dados Esportivos. Uma Partida pode estar nos estados: agendada, em andamento, encerrada.

## Resultado Oficial
Placar final de uma Partida, obtido automaticamente via API de Dados Esportivos após o encerramento do jogo. Considerado ao fim dos 90 minutos regulamentares.

## Pontuação do Usuário
Pontos acumulados por um Usuário com base na precisão dos seus Palpites:
- Placar exato: 3 pontos
- Vencedor correto ou empate com placar errado: 1 ponto
- Palpite incorreto: 0 pontos

## Fase de Grupos
Primeira fase da Copa, com 8 grupos de 4 seleções cada. Os Usuários podem fazer Palpites para todas as Partidas desta fase. Única fase com Palpites habilitados na v1.

## Tabela de Grupos Real
Classificação oficial das seleções dentro de cada grupo, calculada com base nos Resultados Oficiais (vitória: +3 pts para a seleção, empate: +1 pt cada, derrota: 0 pts). Alimentada pela API de Dados Esportivos.

## Tabela de Grupos Simulada
Classificação hipotética das seleções dentro de cada grupo, calculada com base nos Palpites do próprio Usuário. Cada Usuário vê sua própria versão.

## Leaderboard
Ranking dos Usuários ordenado por Pontuação do Usuário. Exibe: posição, nome, pontos totais, e variação de posição em relação à rodada anterior (↑ subiu, ↓ desceu).

## API de Dados Esportivos
Serviço externo (API-Football) que fornece dados das Partidas: horários, seleções, e Resultados Oficiais automaticamente.

## Mata-mata
Fases eliminatórias após a Fase de Grupos (oitavas, quartas, semifinais, final). As Partidas do Mata-mata são exibidas no app mas Palpites não estão disponíveis na v1.
