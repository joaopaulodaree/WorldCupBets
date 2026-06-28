-- Fix bracket_picks and group_position_points to reference public.users
-- instead of auth.users. The app uses custom auth (public.users),
-- so auth.users FKs caused FK violations on every insert.

-- Drop the incorrect FK constraints
ALTER TABLE public.bracket_picks DROP CONSTRAINT bracket_picks_user_id_fkey;
ALTER TABLE public.group_position_points DROP CONSTRAINT group_position_points_user_id_fkey;

-- Re-add with correct reference
ALTER TABLE public.bracket_picks
  ADD CONSTRAINT bracket_picks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.group_position_points
  ADD CONSTRAINT group_position_points_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Drop the bracket_picks RLS policies that used auth.uid() (always null under custom auth)
DROP POLICY IF EXISTS "Users can read own bracket_picks" ON public.bracket_picks;
DROP POLICY IF EXISTS "Users can insert own bracket_picks" ON public.bracket_picks;
