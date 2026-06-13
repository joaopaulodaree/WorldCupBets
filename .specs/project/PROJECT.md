# WorldCupBets — Project Vision

## O que é

Bolão da Copa do Mundo 2026. Usuários fazem palpites de placar exato para os jogos da fase de grupos, acumulam pontos e competem num leaderboard. Sem dinheiro real — só diversão competitiva entre amigos.

## Objetivos

- Permitir que qualquer pessoa se cadastre e faça palpites nos 48 jogos da fase de grupos
- Calcular pontuação automaticamente quando os resultados oficiais chegam via API
- Mostrar a tabela de grupos real vs. a tabela simulada pelos palpites do usuário
- Exibir um leaderboard em tempo real com ranking e variação de posição

## Fora de escopo (v1)

- Palpites no mata-mata (exibido mas sem interação)
- Notificações push / email
- Dinheiro real / sistema de pagamento
- Grupos privados / múltiplos bolões
- Perfis de usuário elaborados

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Estilização | Tailwind CSS + Framer Motion |
| Backend/DB | Supabase (PostgreSQL + Auth) |
| API externa | API-Football (resultados oficiais) |
| Deploy | Vercel |
| PWA | next-pwa |

## Identidade Visual

Dark mode. Verde (#009C3B) e amarelo (#FFDF00) do Brasil. Tipografia moderna. Sensação de placar de estádio.

## Usuários-alvo

Grupos de amigos brasileiros acompanhando a Copa do Mundo 2026.
