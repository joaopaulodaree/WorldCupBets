# WorldCupBets — State

## Decisions

| ID | Decisão | Motivo |
|----|---------|--------|
| D-001 | Palpites apenas na fase de grupos (v1) | Simplifica o escopo; mata-mata tem lógica diferente (prorrogação, pênaltis) |
| D-002 | Resultado oficial = placar aos 90 min | Padrão de bolão; evita complexidade de prorrogação/pênaltis no scoring |
| D-003 | Resultados via API-Football (não admin manual) | Copa tem só 48 jogos na fase de grupos; API-Football free tier (100 req/dia) é suficiente |
| D-004 | Cadastro aberto (sem convite) | Facilita onboarding; não há necessidade de controle de acesso |
| D-005 | Tabela simulada é individual por usuário | Cada usuário vê a projeção dos seus próprios palpites; tabela coletiva teria conflitos |
| D-006 | Sem notificações na v1 | Adiciona infraestrutura complexa; bolão entre amigos, WhatsApp resolve |
| D-007 | Pontuação: exato=3pts, vencedor=1pt, erro=0pts | Esquema clássico de bolão, intuitivo e amplamente conhecido |
| D-008 | Leaderboard mostra posição + pontos + variação (↑↓) | Variação de posição cria sensação de corrida e aumenta engajamento |

## Blockers

Nenhum no momento.

## Lessons

Nenhuma ainda.

## Deferred Ideas

- Palpites no mata-mata (v2)
- Notificações push/email antes dos jogos
- Múltiplos bolões / grupos privados
- Perfil de usuário com histórico de palpites
- Estatísticas: % de acerto por usuário, seleção mais palpitada
- Bracket dinâmico baseado nos palpites da fase de grupos

## Preferences

- Respostas em português
