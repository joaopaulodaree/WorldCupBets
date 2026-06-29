-- supabase/migrations/20260629000001_bracket_score_picks.sql
-- Add score columns for score-based bracket predictions.
-- team_id (predicted winner) is derived from goals on submit and remains non-null.
ALTER TABLE public.bracket_picks
  ADD COLUMN home_goals smallint CHECK (home_goals >= 0),
  ADD COLUMN away_goals smallint CHECK (away_goals >= 0);
