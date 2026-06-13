-- Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code char(3) NOT NULL UNIQUE,
  flag_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id integer,
  group_name char(1) NOT NULL CHECK (group_name IN ('A','B','C','D','E','F','G','H','I','J','K','L')),
  round smallint NOT NULL CHECK (round IN (1,2,3)),
  home_team_id uuid NOT NULL REFERENCES public.teams(id),
  away_team_id uuid NOT NULL REFERENCES public.teams(id),
  kickoff_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finished')),
  home_goals smallint,
  away_goals smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_kickoff ON public.matches(kickoff_at);
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_matches_group ON public.matches(group_name, round);

-- RLS: leitura pública, escrita apenas via service role (cron/seed)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read teams"
  ON public.teams FOR SELECT USING (true);

CREATE POLICY "Public can read matches"
  ON public.matches FOR SELECT USING (true);
