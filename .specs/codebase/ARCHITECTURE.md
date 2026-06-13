# Architecture

## Visão Geral

```
┌─────────────────────────────────────────────────┐
│                   Vercel (Edge)                  │
│  ┌─────────────────────────────────────────┐    │
│  │         Next.js 14 App Router           │    │
│  │  ┌──────────┐  ┌──────────┐            │    │
│  │  │  Pages   │  │   API    │            │    │
│  │  │ (RSC)    │  │  Routes  │            │    │
│  │  └──────────┘  └──────────┘            │    │
│  │  ┌──────────────────────────┐          │    │
│  │  │   Vercel Cron Job        │          │    │
│  │  │   /api/cron/sync-results │          │    │
│  │  └──────────────────────────┘          │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
   ┌──────────────┐    ┌──────────────────┐
   │   Supabase   │    │  API-Football    │
   │  PostgreSQL  │    │  (resultados)    │
   │  + Auth      │    └──────────────────┘
   └──────────────┘
```

## Estrutura de Pastas

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/                    # Rotas protegidas
│   │   ├── layout.tsx            # Shell com navegação
│   │   ├── page.tsx              # Redirect → /matches
│   │   ├── matches/
│   │   │   └── page.tsx          # Lista de partidas + palpites
│   │   ├── groups/
│   │   │   └── page.tsx          # Tabelas de grupos
│   │   ├── leaderboard/
│   │   │   └── page.tsx          # Ranking
│   │   └── profile/
│   │       └── page.tsx          # Perfil do usuário
│   └── api/
│       ├── cron/
│       │   └── sync-results/route.ts   # Cron job de resultados
│       └── predictions/
│           └── route.ts                # CRUD de palpites
├── components/
│   ├── ui/                       # Primitivos (Button, Card, Badge...)
│   ├── match/                    # MatchCard, MatchList, PredictionForm
│   ├── group/                    # GroupTable, GroupSelector
│   ├── leaderboard/              # LeaderboardTable, RankRow
│   └── layout/                   # BottomNav, Sidebar, Header
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── middleware.ts         # Auth middleware
│   ├── api-football/
│   │   └── client.ts             # API-Football wrapper
│   ├── scoring.ts                # Lógica de pontuação
│   ├── group-table.ts            # Cálculo da tabela de grupos
│   └── types.ts                  # TypeScript types globais
└── middleware.ts                 # Proteção de rotas
```

## Banco de Dados (Supabase PostgreSQL)

### Tabelas principais

```sql
-- Seleções
teams (
  id uuid PK,
  name text,
  code char(3),        -- BRA, ARG, etc.
  flag_url text,
  group_letter char(1) -- A-H
)

-- Partidas
matches (
  id uuid PK,
  external_id integer,       -- ID API-Football
  group_letter char(1),
  round integer,             -- 1, 2, 3
  kickoff_at timestamptz,
  home_team_id uuid FK teams,
  away_team_id uuid FK teams,
  home_goals integer,        -- null se não encerrada
  away_goals integer,        -- null se não encerrada
  status text                -- scheduled | live | finished
)

-- Palpites
predictions (
  id uuid PK,
  user_id uuid FK auth.users,
  match_id uuid FK matches,
  home_goals integer NOT NULL,
  away_goals integer NOT NULL,
  points integer,            -- null até partida encerrada
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE (user_id, match_id)
)

-- Snapshots do leaderboard (para variação de posição)
leaderboard_snapshots (
  id uuid PK,
  user_id uuid FK auth.users,
  position integer,
  total_points integer,
  snapshotted_at timestamptz
)

-- Perfis de usuário (complementa auth.users)
profiles (
  id uuid PK FK auth.users,
  display_name text NOT NULL,
  created_at timestamptz
)
```

### Row Level Security (RLS)
- `predictions`: usuário lê/escreve apenas seus próprios palpites
- `profiles`: leitura pública, escrita apenas do próprio usuário
- `matches`, `teams`: leitura pública, sem escrita pelo cliente
- `leaderboard_snapshots`: leitura pública, sem escrita pelo cliente

## Fluxo de Sincronização de Resultados

```
Vercel Cron (*/5 * * * *)
  → GET /api/cron/sync-results
  → Busca partidas com status != 'finished' e kickoff_at < now()
  → Para cada uma: GET api-football.com/fixtures/{id}
  → Se encerrada: UPDATE matches SET home_goals, away_goals, status='finished'
  → Para cada prediction dessa partida: calcular e UPDATE points
  → INSERT leaderboard_snapshots (posições atuais)
```

## Cálculo da Tabela de Grupos

Função `calculateGroupTable(matches, predictions?, useSimulated)`:
- Input: lista de partidas do grupo com resultados (reais ou palpites do usuário)
- Para partidas simuladas sem palpite: usar 0x0
- Output: array de seleções ordenadas por pontos → saldo → gols pró → nome

## Decisões de Arquitetura

- **Server Components por padrão** — dados buscados no servidor, menos JS no cliente
- **API Route para palpites** — mutação com validação server-side da trava temporal
- **Cron via Vercel** — sem infraestrutura adicional, gratuito no plano hobby
- **Sem realtime websocket** — revalidação do Next.js cache a cada 5 min é suficiente
- **Pontuação calculada no cron** — simples, consistente, não precisa de triggers complexos
