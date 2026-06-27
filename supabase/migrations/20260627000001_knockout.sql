-- supabase/migrations/20260627000001_knockout.sql

-- Partidas do mata-mata (separada de matches que é exclusiva para grupos)
CREATE TABLE public.knockout_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id integer UNIQUE,
  round smallint NOT NULL CHECK (round IN (5,6,7,8,9)),
  slot smallint NOT NULL,
  home_team_id uuid REFERENCES public.teams(id),
  away_team_id uuid REFERENCES public.teams(id),
  winner_team_id uuid REFERENCES public.teams(id),
  kickoff_at timestamptz,
  status text NOT NULL DEFAULT 'tbd' CHECK (status IN ('tbd','scheduled','live','finished')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round, slot)
);

CREATE INDEX idx_knockout_matches_round ON public.knockout_matches(round);
CREATE INDEX idx_knockout_matches_status ON public.knockout_matches(status);

-- Picks de cada usuário no bracket (draft vive no localStorage; banco só tem is_submitted=true)
CREATE TABLE public.bracket_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round smallint NOT NULL CHECK (round IN (5,6,7,8,9)),
  slot smallint NOT NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  is_correct boolean,
  points smallint,
  is_submitted boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, round, slot)
);

CREATE INDEX idx_bracket_picks_user ON public.bracket_picks(user_id);

-- Pontos de posição de grupo (calculado batch quando grupos fecham)
CREATE TABLE public.group_position_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name char(1) NOT NULL,
  correct_positions smallint NOT NULL DEFAULT 0 CHECK (correct_positions BETWEEN 0 AND 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_name)
);

-- RLS
ALTER TABLE public.knockout_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read knockout_matches"
  ON public.knockout_matches FOR SELECT USING (true);

ALTER TABLE public.bracket_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own bracket_picks"
  ON public.bracket_picks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bracket_picks"
  ON public.bracket_picks FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE policy for users: cron uses service_role (bypasses RLS) to update is_correct/points

ALTER TABLE public.group_position_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read group_position_points"
  ON public.group_position_points FOR SELECT USING (true);
