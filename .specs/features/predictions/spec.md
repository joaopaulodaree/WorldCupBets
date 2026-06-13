# Feature: Predictions — Palpites de Placar

## Objetivo
Permitir que usuários autenticados façam e editem palpites de placar exato para cada partida da fase de grupos, com trava automática no início do jogo.

## Requisitos

### Criação e edição
- **PRED-001** O usuário pode palpitar o placar exato de qualquer partida da fase de grupos (ex: Brasil 2, Marrocos 1)
- **PRED-002** Palpites são números inteiros não negativos (0 a 99)
- **PRED-003** O usuário pode alterar o palpite quantas vezes quiser enquanto a partida não começou
- **PRED-004** Cada usuário tem no máximo 1 palpite por partida (upsert)

### Trava
- **PRED-005** Palpites ficam bloqueados para edição quando `now() >= match.kickoff_time`
- **PRED-006** A UI exibe estado visual claro para palpites travados (sem campo de edição, ícone de cadeado)
- **PRED-007** Tentativas de salvar palpite em partida iniciada são rejeitadas também no backend (não só UI)

### Estados do palpite
- **PRED-008** Palpite pendente: partida não iniciada, editável
- **PRED-009** Palpite travado: partida iniciada, não editável, resultado ainda desconhecido
- **PRED-010** Palpite avaliado: partida encerrada, exibe resultado real ao lado do palpite e os pontos ganhos
- **PRED-011** Sem palpite: usuário não palpitou naquela partida (exibe slot vazio ou CTA para palpitar)

### Visualização
- **PRED-012** O usuário vê todos os seus palpites na tela de partidas (integrado à lista de jogos)
- **PRED-013** Palpites avaliados exibem badge colorido: verde (acertou exato), amarelo (acertou vencedor), vermelho (errou)
- **PRED-014** Contagem de palpites feitos vs. total de partidas da fase de grupos exibida no perfil/header

## Notas de implementação
- Tabela `predictions`: user_id, match_id, home_goals, away_goals, created_at, updated_at
- Unique constraint em (user_id, match_id)
- Row Level Security no Supabase: usuário só lê e escreve seus próprios palpites
- Scoring calculado via trigger ou função no banco quando resultado é inserido

## Critério de aceite
Usuário palpita Brasil 2x1 Marrocos. Antes do jogo: pode editar. Após início: campo some, aparece cadeado. Após fim: aparece "Brasil 3x0 Marrocos — você palpitou 2x1, +1 ponto (acertou o vencedor)".
