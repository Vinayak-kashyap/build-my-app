import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  /** search radius in degrees around the centre point */
  span: z.number().min(0.01).max(2).default(0.25),
  region: z.string().optional(),
  digest: z.boolean().default(true),
});

export type ForecastResult = {
  predictions: number;
  headline: string | null;
  narrative: string | null;
  weather: string | null;
};

export const generateForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ForecastResult> => {
    const aiKey = process.env.LOVABLE_API_KEY;
    if (!aiKey) throw new Error("AI is not configured");
    const weatherKey = process.env.OPENWEATHERMAP_API_KEY;

    const {
      clusterReports,
      fetchWeather,
      forecastCells,
      summariseForAuthorities,
      writePredictions,
    } = await import("@/lib/predict.server");

    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("reports")
      .select("latitude, longitude, address, severity, damage_types, created_at")
      .gte("created_at", since)
      .gte("latitude", data.lat - data.span)
      .lte("latitude", data.lat + data.span)
      .gte("longitude", data.lng - data.span)
      .lte("longitude", data.lng + data.span)
      .limit(500);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { predictions: 0, headline: null, narrative: null, weather: null };

    const cells = clusterReports(rows as never);
    const weather = weatherKey ? await fetchWeather(data.lat, data.lng, weatherKey) : null;
    const drafts = await forecastCells(aiKey, cells, weather);
    const written = await writePredictions(context.supabase, drafts, weather);

    let digest: { headline: string; narrative: string } | null = null;
    if (data.digest && drafts.length) {
      digest = await summariseForAuthorities(aiKey, drafts, weather);
      if (digest) {
        await context.supabase.from("prediction_digests").insert({
          region: data.region ?? null,
          period: "weekly",
          headline: digest.headline,
          narrative: digest.narrative,
          top_roads: drafts
            .slice()
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 5)
            .map((d) => ({
              address: d.address,
              risk_level: d.risk_level,
              risk_score: d.risk_score,
              predicted_damage: d.predicted_damage,
            })),
        });
      }
    }

    return {
      predictions: written,
      headline: digest?.headline ?? null,
      narrative: digest?.narrative ?? null,
      weather: weather?.summary ?? null,
    };
  });
