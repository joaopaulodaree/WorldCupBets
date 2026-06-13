CREATE TABLE public.leaderboard_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position   smallint NOT NULL,
  points     smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX idx_leaderboard_snapshots_match ON public.leaderboard_snapshots(match_id);
CREATE INDEX idx_leaderboard_snapshots_user ON public.leaderboard_snapshots(user_id);
