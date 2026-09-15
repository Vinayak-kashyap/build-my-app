ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS district text NOT NULL DEFAULT 'Lucknow',
  ADD COLUMN IF NOT EXISTS bike_severity public.severity_level,
  ADD COLUMN IF NOT EXISTS car_severity public.severity_level;

UPDATE public.reports SET bike_severity = severity WHERE bike_severity IS NULL;
UPDATE public.reports SET car_severity = severity WHERE car_severity IS NULL;

CREATE INDEX IF NOT EXISTS reports_district_idx ON public.reports (district);

-- default vehicle-specific severities when the client does not supply them
CREATE OR REPLACE FUNCTION public.default_vehicle_severity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE bike_bump boolean;
BEGIN
  bike_bump := ('pothole' = ANY(NEW.damage_types)
             OR 'waterlogging' = ANY(NEW.damage_types)
             OR 'drainage' = ANY(NEW.damage_types));
  IF NEW.bike_severity IS NULL THEN
    NEW.bike_severity := CASE
      WHEN NOT bike_bump THEN NEW.severity
      WHEN NEW.severity = 'minor' THEN 'moderate'::public.severity_level
      ELSE 'critical'::public.severity_level
    END;
  END IF;
  IF NEW.car_severity IS NULL THEN
    NEW.car_severity := NEW.severity;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.default_vehicle_severity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_vehicle_severity ON public.reports;
CREATE TRIGGER reports_vehicle_severity BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.default_vehicle_severity();

CREATE TYPE public.civic_portal AS ENUM ('everything_civic', 'lucknow_smart_city', 'lucknow_nagar_nigam');
CREATE TYPE public.civic_submission_status AS ENUM ('queued', 'submitting', 'submitted', 'failed', 'manual_required');

CREATE TABLE public.civic_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  portal public.civic_portal NOT NULL,
  status public.civic_submission_status NOT NULL DEFAULT 'queued',
  complaint_number text,
  tracking_url text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, portal)
);

CREATE INDEX civic_submissions_status_idx ON public.civic_submissions (status, created_at);
CREATE INDEX civic_submissions_report_idx ON public.civic_submissions (report_id);

GRANT SELECT ON public.civic_submissions TO authenticated;
GRANT UPDATE ON public.civic_submissions TO authenticated;
GRANT ALL ON public.civic_submissions TO service_role;
ALTER TABLE public.civic_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view civic submissions for their reports" ON public.civic_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authorities view all civic submissions" ON public.civic_submissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authorities update civic submissions" ON public.civic_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER civic_submissions_updated_at BEFORE UPDATE ON public.civic_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.civic_submission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.civic_submissions(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX civic_submission_logs_submission_idx ON public.civic_submission_logs (submission_id, created_at DESC);

GRANT SELECT ON public.civic_submission_logs TO authenticated;
GRANT ALL ON public.civic_submission_logs TO service_role;
ALTER TABLE public.civic_submission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorities view civic logs" ON public.civic_submission_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view civic logs for their reports" ON public.civic_submission_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.civic_submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.enqueue_civic_submissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.civic_submissions (report_id, user_id, portal, request_payload)
  SELECT NEW.id, NEW.user_id, p, jsonb_build_object(
    'latitude', NEW.latitude,
    'longitude', NEW.longitude,
    'address', NEW.address,
    'district', NEW.district,
    'severity', NEW.severity,
    'damage_types', to_jsonb(NEW.damage_types),
    'notes', NEW.notes,
    'summary', NEW.ai_summary
  )
  FROM unnest(ARRAY['everything_civic','lucknow_smart_city']::public.civic_portal[]) AS p
  ON CONFLICT (report_id, portal) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_civic_submissions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_enqueue_civic ON public.reports;
CREATE TRIGGER reports_enqueue_civic AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_civic_submissions();