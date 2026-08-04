
CREATE OR REPLACE FUNCTION public.leaderboard(_scope text DEFAULT 'national', _limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  city text,
  state text,
  points integer,
  streak_days integer,
  report_count bigint,
  weekly_points bigint,
  rank bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH me AS (
    SELECT city AS my_city, state AS my_state FROM public.profiles WHERE id = auth.uid()
  ), scoped AS (
    SELECT p.* FROM public.profiles p, me
     WHERE CASE
       WHEN _scope = 'city' THEN p.city IS NOT DISTINCT FROM me.my_city
       WHEN _scope = 'state' THEN p.state IS NOT DISTINCT FROM me.my_state
       ELSE true
     END
  )
  SELECT s.id,
         s.full_name,
         s.username,
         s.avatar_url,
         s.city,
         s.state,
         s.points,
         s.streak_days,
         (SELECT count(*) FROM public.reports r WHERE r.user_id = s.id) AS report_count,
         COALESCE((SELECT sum(e.points) FROM public.point_events e
                    WHERE e.user_id = s.id AND e.created_at >= now() - interval '7 days'), 0) AS weekly_points,
         rank() OVER (ORDER BY s.points DESC, s.id) AS rank
    FROM scoped s
   ORDER BY s.points DESC, s.id
   LIMIT _limit;
$$;
REVOKE EXECUTE ON FUNCTION public.leaderboard(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard(text, integer) TO authenticated;
