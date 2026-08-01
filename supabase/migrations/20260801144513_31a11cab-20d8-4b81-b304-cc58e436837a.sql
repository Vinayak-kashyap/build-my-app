CREATE TYPE public.risk_level AS ENUM ('low', 'moderate', 'high', 'critical');

CREATE TABLE public.road_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  risk_level public.risk_level NOT NULL DEFAULT 'moderate',
  risk_score integer NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
  window_days integer NOT NULL DEFAULT 14 CHECK (window_days BETWEEN 7 AND 30),
  predicted_damage text,
  rationale text,
  weather_summary text,
  rainfall_mm numeric,
  avg_temp_c numeric,
  report_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.road_predictions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.road_predictions TO authenticated;
GRANT ALL ON public.road_predictions TO service_role;

ALTER TABLE public.road_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view predictions"
  ON public.road_predictions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorities manage predictions"
  ON public.road_predictions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.prediction_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text,
  period text NOT NULL DEFAULT 'weekly',
  headline text NOT NULL,
  narrative text NOT NULL,
  top_roads jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prediction_digests TO authenticated;
GRANT ALL ON public.prediction_digests TO service_role;

ALTER TABLE public.prediction_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorities view digests"
  ON public.prediction_digests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authorities manage digests"
  ON public.prediction_digests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'authority') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_road_predictions_updated_at
  BEFORE UPDATE ON public.road_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prediction_digests_updated_at
  BEFORE UPDATE ON public.prediction_digests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_road_predictions_expires ON public.road_predictions (expires_at DESC);