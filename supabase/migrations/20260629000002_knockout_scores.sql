-- Add actual score columns to knockout_matches for scoring bracket picks.
ALTER TABLE public.knockout_matches
  ADD COLUMN home_score smallint CHECK (home_score >= 0),
  ADD COLUMN away_score smallint CHECK (away_score >= 0);
