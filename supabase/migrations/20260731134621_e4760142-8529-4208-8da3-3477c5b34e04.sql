CREATE TYPE public.damage_type AS ENUM (
  'pothole', 'crack', 'waterlogging', 'landslide', 'drainage', 'bridge_damage', 'streetlight_failure', 'guardrail_damage'
);
CREATE TYPE public.severity_level AS ENUM ('minor', 'moderate', 'critical');
CREATE TYPE public.repair_status AS ENUM ('pending', 'in_progress', 'resolved');

CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  damage_types public.damage_type[] NOT NULL DEFAULT '{}',
  severity public.severity_level NOT NULL DEFAULT 'moderate',
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  ai_suggestion TEXT,
  ai_summary TEXT,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  photos TEXT[] NOT NULL DEFAULT '{}',
  status public.repair_status NOT NULL DEFAULT 'pending',
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 1,
  community_verified BOOLEAN NOT NULL DEFAULT false,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reports_location_idx ON public.reports (latitude, longitude);
CREATE INDEX reports_created_at_idx ON public.reports (created_at DESC);
CREATE INDEX reports_user_idx ON public.reports (user_id);

GRANT SELECT ON public.reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view non-flagged reports"
  ON public.reports FOR SELECT TO anon
  USING (is_flagged = false);

CREATE POLICY "Signed-in users can view reports"
  ON public.reports FOR SELECT TO authenticated
  USING (is_flagged = false OR user_id = auth.uid() OR public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authorities can update any report"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own reports"
  ON public.reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.report_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

GRANT SELECT ON public.report_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_votes TO authenticated;
GRANT ALL ON public.report_votes TO service_role;

ALTER TABLE public.report_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
  ON public.report_votes FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Users can manage their own votes"
  ON public.report_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_report_votes_updated_at
  BEFORE UPDATE ON public.report_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.recalc_report_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID := COALESCE(NEW.report_id, OLD.report_id);
  up INTEGER;
  down INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE value = 1),
    COUNT(*) FILTER (WHERE value = -1)
  INTO up, down
  FROM public.report_votes WHERE report_id = target;

  UPDATE public.reports
  SET upvotes = up,
      downvotes = down,
      community_verified = (up >= 3 AND up > down * 2),
      is_flagged = (down >= 5 AND down > up * 2)
  WHERE id = target;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalc_report_votes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER report_votes_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.report_votes
  FOR EACH ROW EXECUTE FUNCTION public.recalc_report_votes();

ALTER TABLE public.reports REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

CREATE POLICY "Signed-in users can view report photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-photos');

CREATE POLICY "Users can upload their own report photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own report photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own report photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);