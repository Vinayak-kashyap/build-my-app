
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS last_report_on date,
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS point_events_user_created_idx ON public.point_events (user_id, created_at DESC);
GRANT SELECT ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own point events" ON public.point_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are viewable by signed-in users" ON public.user_badges
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _points integer, _reason text, _report_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _points = 0 THEN RETURN; END IF;
  INSERT INTO public.point_events (user_id, points, reason, report_id)
  VALUES (_user_id, _points, _reason, _report_id);
  UPDATE public.profiles SET points = GREATEST(0, points + _points) WHERE id = _user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_badges(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_reports integer;
  verified_reports integer;
  streak integer;
BEGIN
  SELECT count(*) INTO total_reports FROM public.reports WHERE user_id = _user_id;
  SELECT count(*) INTO verified_reports FROM public.reports WHERE user_id = _user_id AND community_verified;
  SELECT streak_days INTO streak FROM public.profiles WHERE id = _user_id;

  IF total_reports >= 1 THEN
    INSERT INTO public.user_badges (user_id, badge_key) VALUES (_user_id, 'first_report') ON CONFLICT DO NOTHING;
  END IF;
  IF total_reports >= 25 THEN
    INSERT INTO public.user_badges (user_id, badge_key) VALUES (_user_id, 'road_guardian') ON CONFLICT DO NOTHING;
  END IF;
  IF total_reports >= 100 THEN
    INSERT INTO public.user_badges (user_id, badge_key) VALUES (_user_id, 'hundred_reports') ON CONFLICT DO NOTHING;
  END IF;
  IF verified_reports >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_key) VALUES (_user_id, 'verified_contributor') ON CONFLICT DO NOTHING;
  END IF;
  IF COALESCE(streak, 0) >= 7 THEN
    INSERT INTO public.user_badges (user_id, badge_key) VALUES (_user_id, 'week_warrior') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.evaluate_badges(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_report_gamification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_on date;
  new_streak integer;
  bonus integer := 0;
BEGIN
  SELECT last_report_on, streak_days INTO last_on, new_streak FROM public.profiles WHERE id = NEW.user_id;

  IF last_on IS NULL OR last_on < CURRENT_DATE - 1 THEN
    new_streak := 1;
  ELSIF last_on = CURRENT_DATE - 1 THEN
    new_streak := COALESCE(new_streak, 0) + 1;
  ELSE
    new_streak := GREATEST(COALESCE(new_streak, 0), 1);
  END IF;

  UPDATE public.profiles
     SET streak_days = new_streak,
         longest_streak = GREATEST(longest_streak, new_streak),
         last_report_on = CURRENT_DATE
   WHERE id = NEW.user_id;

  IF new_streak >= 7 THEN bonus := 10;
  ELSIF new_streak >= 3 THEN bonus := 5;
  END IF;

  PERFORM public.award_points(NEW.user_id, 10, 'report_submitted', NEW.id);
  IF bonus > 0 AND (last_on IS NULL OR last_on <> CURRENT_DATE) THEN
    PERFORM public.award_points(NEW.user_id, bonus, 'streak_bonus', NEW.id);
  END IF;
  PERFORM public.evaluate_badges(NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_report_gamification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_gamification ON public.reports;
CREATE TRIGGER reports_gamification AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_gamification();

CREATE OR REPLACE FUNCTION public.handle_report_verified_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.community_verified AND NOT COALESCE(OLD.community_verified, false) THEN
    PERFORM public.award_points(NEW.user_id, 25, 'report_verified', NEW.id);
    -- reward voters whose upvote matched the community verdict
    INSERT INTO public.point_events (user_id, points, reason, report_id)
    SELECT v.user_id, 2, 'accurate_vote', NEW.id
      FROM public.report_votes v
     WHERE v.report_id = NEW.id AND v.value = 1 AND v.user_id <> NEW.user_id;
    UPDATE public.profiles p
       SET points = p.points + 2
      FROM public.report_votes v
     WHERE v.report_id = NEW.id AND v.value = 1 AND v.user_id <> NEW.user_id AND p.id = v.user_id;
    PERFORM public.evaluate_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_report_verified_points() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_verified_points ON public.reports;
CREATE TRIGGER reports_verified_points AFTER UPDATE OF community_verified ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_verified_points();

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
SECURITY DEFINER
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
