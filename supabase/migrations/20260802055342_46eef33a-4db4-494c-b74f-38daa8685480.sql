
-- ============ reports: prioritisation + AI confidence baseline ============
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS accident_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID;

UPDATE public.reports SET ai_confidence = confidence WHERE ai_confidence = 70;

-- ============ notifications ============
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('hazard','authority','repair','prediction','community');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_label TEXT,
  severity public.severity_level,
  read BOOLEAN NOT NULL DEFAULT false,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update their own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ notification settings ============
CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  hazard_proximity BOOLEAN NOT NULL DEFAULT true,
  alert_radius_m INTEGER NOT NULL DEFAULT 500,
  authority_alerts BOOLEAN NOT NULL DEFAULT true,
  repair_updates BOOLEAN NOT NULL DEFAULT true,
  prediction_warnings BOOLEAN NOT NULL DEFAULT true,
  vote_activity BOOLEAN NOT NULL DEFAULT true,
  weekly_digest_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notification settings" ON public.notification_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_settings_updated_at BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ weighted crowd confidence ============
CREATE OR REPLACE FUNCTION public.vote_weight(_user_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT LEAST(3.0, 0.5 + COALESCE((SELECT points FROM public.profiles WHERE id = _user_id), 0) / 400.0
    + CASE WHEN public.has_role(_user_id, 'authority') OR public.has_role(_user_id, 'admin') THEN 1.5 ELSE 0 END);
$$;
REVOKE EXECUTE ON FUNCTION public.vote_weight(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recalc_report_votes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target UUID := COALESCE(NEW.report_id, OLD.report_id);
  up INTEGER; down INTEGER;
  w_up NUMERIC; w_down NUMERIC;
  rep RECORD;
  crowd NUMERIC; new_conf NUMERIC;
  verified BOOLEAN; flagged BOOLEAN;
BEGIN
  SELECT COUNT(*) FILTER (WHERE value = 1), COUNT(*) FILTER (WHERE value = -1),
         COALESCE(SUM(public.vote_weight(user_id)) FILTER (WHERE value = 1), 0),
         COALESCE(SUM(public.vote_weight(user_id)) FILTER (WHERE value = -1), 0)
  INTO up, down, w_up, w_down
  FROM public.report_votes WHERE report_id = target;

  SELECT * INTO rep FROM public.reports WHERE id = target;
  IF NOT FOUND THEN RETURN NULL; END IF;

  crowd := LEAST(40, GREATEST(-45, (w_up - w_down) * 6 + (GREATEST(rep.report_count, 1) - 1) * 4));
  new_conf := LEAST(99, GREATEST(5, rep.ai_confidence * 0.6 + 20 + crowd));
  verified := (w_up >= 3 AND w_up > w_down * 2 AND new_conf >= 75);
  flagged := (w_down >= 5 AND w_down > w_up * 2) OR new_conf < 25;

  UPDATE public.reports
  SET upvotes = up, downvotes = down, confidence = new_conf,
      community_verified = verified, is_flagged = flagged
  WHERE id = target;

  IF verified AND NOT rep.community_verified THEN
    INSERT INTO public.notifications (user_id, type, title, body, report_id, latitude, longitude, location_label, severity)
    SELECT ur.user_id, 'authority',
      'Report reached community verification',
      COALESCE(rep.ai_summary, rep.ai_suggestion, 'A road damage report crossed the confidence threshold.'),
      rep.id, rep.latitude, rep.longitude, rep.address, rep.severity
    FROM public.user_roles ur
    WHERE ur.role IN ('authority','admin');
  END IF;

  IF rep.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, report_id, latitude, longitude, location_label, severity)
    SELECT rep.user_id, 'community',
      'New activity on your report',
      'Your report now has ' || up || ' confirmations and ' || down || ' disputes.',
      rep.id, rep.latitude, rep.longitude, rep.address, rep.severity
    WHERE COALESCE((SELECT vote_activity FROM public.notification_settings WHERE user_id = rep.user_id), true);
  END IF;

  RETURN NULL;
END;
$$;

-- ============ repair priority scoring ============
CREATE OR REPLACE FUNCTION public.compute_priority_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s NUMERIC := 0;
BEGIN
  IF NEW.status = 'resolved' THEN
    NEW.priority_score := 0;
    RETURN NEW;
  END IF;
  s := CASE NEW.severity WHEN 'critical' THEN 45 WHEN 'moderate' THEN 25 ELSE 10 END;
  s := s + LEAST(NEW.report_count, 10) * 3;
  s := s + NEW.confidence * 0.25;
  s := s + LEAST(NEW.accident_count, 10) * 4;
  IF 'Near School' = ANY(NEW.tags) THEN s := s + 12; END IF;
  IF 'Near Hospital' = ANY(NEW.tags) THEN s := s + 12; END IF;
  IF 'Near Intersection' = ANY(NEW.tags) THEN s := s + 6; END IF;
  IF 'Flooding Risk' = ANY(NEW.tags) THEN s := s + 5; END IF;
  IF NEW.community_verified THEN s := s + 10; END IF;
  NEW.priority_score := ROUND(s, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_priority_score ON public.reports;
CREATE TRIGGER reports_priority_score BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.compute_priority_score();

UPDATE public.reports SET updated_at = updated_at;

-- ============ automatic alerts on reports ============
CREATE OR REPLACE FUNCTION public.notify_on_report_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.severity = 'critical' THEN
    INSERT INTO public.notifications (user_id, type, title, body, report_id, latitude, longitude, location_label, severity)
    SELECT ur.user_id, 'authority', 'New critical road damage reported',
      COALESCE(NEW.ai_summary, NEW.ai_suggestion, 'A critical road damage report was submitted.'),
      NEW.id, NEW.latitude, NEW.longitude, NEW.address, NEW.severity
    FROM public.user_roles ur WHERE ur.role IN ('authority','admin');
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
    INSERT INTO public.notifications (user_id, type, title, body, report_id, latitude, longitude, location_label, severity)
    SELECT NEW.user_id, 'repair', 'Repair status updated',
      'Your report is now marked "' || REPLACE(NEW.status::text, '_', ' ') || '".',
      NEW.id, NEW.latitude, NEW.longitude, NEW.address, NEW.severity
    WHERE COALESCE((SELECT repair_updates FROM public.notification_settings WHERE user_id = NEW.user_id), true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_notify ON public.reports;
CREATE TRIGGER reports_notify BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_change();

-- ============ default settings row for new users ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'citizen')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.notification_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO public.notification_settings (user_id)
SELECT id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;
