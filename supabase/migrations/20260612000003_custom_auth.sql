-- Custom auth users table (bypasses Supabase Auth entirely)
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — all access goes through service role key in API routes

-- Drop old predictions table that references auth.users
DROP TABLE IF EXISTS public.predictions;

-- Recreate predictions referencing our custom users table
CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_goals smallint NOT NULL CHECK (home_goals >= 0 AND home_goals <= 99),
  away_goals smallint NOT NULL CHECK (away_goals >= 0 AND away_goals <= 99),
  points smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX idx_predictions_user ON public.predictions(user_id);
CREATE INDEX idx_predictions_match ON public.predictions(match_id);

-- No RLS — API routes use service role key and handle auth themselves

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
