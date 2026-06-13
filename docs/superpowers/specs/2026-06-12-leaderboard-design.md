# Leaderboard — Design Doc

## Contexto

O WorldCupBets permite que usuários façam palpites de placar para partidas da Copa do Mundo 2026. O Leaderboard exibe o ranking de usuários por pontos acumulados, com variação de posição por partida.

## Regras de Pontuação

- Placar exato: **+3 pontos**
- Vencedor correto ou empate com placar errado: **+1 ponto**
- Palpite incorreto: **+0 pontos**

Pontos calculados sobre resultado oficial ao fim dos 90 minutos regulamentares.

## Banco de Dados

### Nova tabela: `leaderboard_snapshots`

```sql
CREATE TABLE public.leaderboard_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position   smallint NOT NULL,
  points     smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);
```

Gravada pelo cron após processar cada partida finalizada. Armazena posição e pontos de cada usuário naquele momento. Idempotente via `ON CONFLICT DO UPDATE`.

### Coluna `predictions.points`

Já existe (nullable smallint). Populada pelo cron ao calcular resultado de cada palpite.

## Fluxo de Pontuação (Cron)

O cron existente em `/api/cron/sync-results` é estendido com dois passos adicionais após cada partida finalizada:

**Passo 1 — Calcular pontos dos palpites:**

Para cada `prediction` da partida recém-finalizada:
- `pred.home_goals == match.home_goals AND pred.away_goals == match.away_goals` → `points = 3`
- `sign(pred.home_goals - pred.away_goals) == sign(match.home_goals - match.away_goals)` → `points = 1`
- Caso contrário → `points = 0`

**Passo 2 — Gravar snapshot do leaderboard:**

Após atualizar todos os `points` da partida:
```sql
INSERT INTO leaderboard_snapshots (match_id, user_id, position, points)
SELECT
  <match_id>,
  user_id,
  RANK() OVER (ORDER BY SUM(points) DESC) AS position,
  SUM(points) AS points
FROM predictions
WHERE points IS NOT NULL
GROUP BY user_id
ON CONFLICT (match_id, user_id) DO UPDATE
  SET position = EXCLUDED.position, points = EXCLUDED.points;
```

## API

### `GET /api/leaderboard`

Sem parâmetros. Retorna o ranking atual com variação de posição.

**Lógica:**

1. Ranking atual: `SUM(predictions.points)` agrupado por `user_id`, com `RANK()`, ordenado DESC. Apenas usuários com ao menos 1 palpite (`points IS NOT NULL`).

2. Snapshot anterior: posição de cada usuário no snapshot da **partida mais recente** com snapshot gravado.

3. Delta: `posição_snapshot_anterior - posição_atual`. Positivo = subiu, negativo = desceu, `null` = sem snapshot (estreia).

**Resposta:**
```json
[
  { "position": 1, "name": "João", "points": 12, "delta": 2 },
  { "position": 2, "name": "Ana",  "points": 9,  "delta": 0 },
  { "position": 3, "name": "Bob",  "points": 6,  "delta": null }
]
```

## UI

**Rota:** `/leaderboard`

**Componentes:**
- Lista ranqueada sem paginação (bolão pequeno, dezenas de usuários)
- Cada linha: posição | nome | pontos | variação
- Top 3 com destaque visual (ouro/prata/bronze)
- Usuário logado destacado com borda/fundo diferente
- Variação: `↑N` (verde), `↓N` (vermelho), `—` (estreia/neutro)
- Estado de carregamento com Skeleton existente
- Estado vazio quando nenhum usuário palpitou ainda

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/YYYYMMDD_leaderboard_snapshots.sql` | Criar |
| `src/app/api/cron/sync-results/route.ts` | Estender |
| `src/app/api/leaderboard/route.ts` | Criar |
| `src/app/(app)/leaderboard/page.tsx` | Implementar |
| `src/components/leaderboard/LeaderboardRow.tsx` | Criar |

## Fora de Escopo (v1)

- Variação por rodada (apenas por partida)
- Paginação
- Filtro por grupo de amigos
- Histórico de posições do usuário
