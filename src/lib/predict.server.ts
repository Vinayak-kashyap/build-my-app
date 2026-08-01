import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Cell = {
  latitude: number;
  longitude: number;
  address: string | null;
  report_count: number;
  severities: string[];
  damage_types: string[];
  last_reported: string;
};

export type WeatherContext = {
  summary: string;
  rainfallMm: number;
  avgTempC: number;
};

export type PredictionDraft = {
  latitude: number;
  longitude: number;
  address: string | null;
  risk_level: "low" | "moderate" | "high" | "critical";
  risk_score: number;
  window_days: number;
  predicted_damage: string;
  rationale: string;
  report_count: number;
};

const CELL = 0.003; // ~330 m

/** Group historical reports into road-segment sized cells. */
export function clusterReports(
  rows: {
    latitude: number;
    longitude: number;
    address: string | null;
    severity: string;
    damage_types: string[];
    created_at: string;
  }[],
): Cell[] {
  const buckets = new Map<string, Cell>();
  for (const row of rows) {
    const key = `${Math.round(row.latitude / CELL)}:${Math.round(row.longitude / CELL)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.report_count += 1;
      existing.severities.push(row.severity);
      for (const t of row.damage_types) {
        if (!existing.damage_types.includes(t)) existing.damage_types.push(t);
      }
      if (row.created_at > existing.last_reported) existing.last_reported = row.created_at;
    } else {
      buckets.set(key, {
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        report_count: 1,
        severities: [row.severity],
        damage_types: [...row.damage_types],
        last_reported: row.created_at,
      });
    }
  }
  return [...buckets.values()]
    .sort((a, b) => b.report_count - a.report_count)
    .slice(0, 12);
}

/** 5-day / 3-hour OpenWeatherMap forecast condensed to rainfall + temperature. */
export async function fetchWeather(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<WeatherContext | null> {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      list?: { main?: { temp?: number }; rain?: { "3h"?: number }; weather?: { main?: string }[] }[];
      city?: { name?: string };
    };
    const list = json.list ?? [];
    if (!list.length) return null;
    const rainfallMm = list.reduce((sum, i) => sum + (i.rain?.["3h"] ?? 0), 0);
    const avgTempC =
      list.reduce((sum, i) => sum + (i.main?.temp ?? 0), 0) / Math.max(1, list.length);
    const conditions = new Set(list.map((i) => i.weather?.[0]?.main).filter(Boolean));
    return {
      summary: `${json.city?.name ?? "Area"}: ${rainfallMm.toFixed(1)} mm rain expected over 5 days, avg ${avgTempC.toFixed(1)}°C, ${[...conditions].join("/")}`,
      rainfallMm: Number(rainfallMm.toFixed(1)),
      avgTempC: Number(avgTempC.toFixed(1)),
    };
  } catch {
    return null;
  }
}

async function callGateway(apiKey: string, body: unknown) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!res.ok) throw new Error(`AI forecast failed (${res.status})`);
  const json = (await res.json()) as {
    choices?: {
      message?: { content?: string; tool_calls?: { function?: { arguments?: string } }[] };
    }[];
  };
  return json.choices?.[0]?.message;
}

export async function forecastCells(
  apiKey: string,
  cells: Cell[],
  weather: WeatherContext | null,
): Promise<PredictionDraft[]> {
  const message = await callGateway(apiKey, {
    model: "openai/gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `You are RoadPulse Forecast, a pavement-deterioration analyst. Given historical damage reports
for road segments plus the weather outlook and typical traffic load, predict how each segment will
deteriorate in the next 7-30 days. Heavy rainfall accelerates potholes and waterlogging; freeze/heat
cycles widen cracks. risk_score is 0-100. window_days is when the deterioration is expected (7-30).
Keep each rationale under 30 words and specific.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          weather: weather?.summary ?? "weather unavailable",
          rainfall_mm_5d: weather?.rainfallMm ?? null,
          avg_temp_c: weather?.avgTempC ?? null,
          segments: cells,
        }),
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "report_forecast",
          description: "Return deterioration forecasts for each road segment.",
          parameters: {
            type: "object",
            properties: {
              predictions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    latitude: { type: "number" },
                    longitude: { type: "number" },
                    risk_level: {
                      type: "string",
                      enum: ["low", "moderate", "high", "critical"],
                    },
                    risk_score: { type: "number" },
                    window_days: { type: "number" },
                    predicted_damage: { type: "string" },
                    rationale: { type: "string" },
                  },
                  required: [
                    "latitude",
                    "longitude",
                    "risk_level",
                    "risk_score",
                    "window_days",
                    "predicted_damage",
                    "rationale",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["predictions"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "report_forecast" } },
  });

  const args = message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no forecast");
  const parsed = JSON.parse(args) as { predictions: PredictionDraft[] };

  return (parsed.predictions ?? []).map((p) => {
    const source =
      cells
        .map((c) => ({
          cell: c,
          d: Math.abs(c.latitude - p.latitude) + Math.abs(c.longitude - p.longitude),
        }))
        .sort((a, b) => a.d - b.d)[0]?.cell ?? null;
    return {
      ...p,
      address: source?.address ?? null,
      report_count: source?.report_count ?? 0,
      risk_score: Math.max(0, Math.min(100, Math.round(p.risk_score))),
      window_days: Math.max(7, Math.min(30, Math.round(p.window_days))),
    };
  });
}

export async function writePredictions(
  supabase: SupabaseClient<Database>,
  drafts: PredictionDraft[],
  weather: WeatherContext | null,
) {
  await supabase.from("road_predictions").delete().lt("expires_at", new Date().toISOString());

  const rows = drafts.map((d) => ({
    latitude: d.latitude,
    longitude: d.longitude,
    address: d.address,
    risk_level: d.risk_level,
    risk_score: d.risk_score,
    window_days: d.window_days,
    predicted_damage: d.predicted_damage,
    rationale: d.rationale,
    report_count: d.report_count,
    weather_summary: weather?.summary ?? null,
    rainfall_mm: weather?.rainfallMm ?? null,
    avg_temp_c: weather?.avgTempC ?? null,
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  }));

  const { error } = await supabase.from("road_predictions").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function summariseForAuthorities(
  apiKey: string,
  drafts: PredictionDraft[],
  weather: WeatherContext | null,
) {
  const message = await callGateway(apiKey, {
    model: "openai/gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `You write short municipal road-maintenance briefings. Produce a headline (max 12 words)
and a narrative (max 90 words) telling authorities which roads need intervention first and why,
referencing rainfall and report history. Plain, decisive language.`,
      },
      {
        role: "user",
        content: JSON.stringify({ weather: weather?.summary ?? null, predictions: drafts }),
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "report_digest",
          description: "Return the authority briefing.",
          parameters: {
            type: "object",
            properties: {
              headline: { type: "string" },
              narrative: { type: "string" },
            },
            required: ["headline", "narrative"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "report_digest" } },
  });

  const args = message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  return JSON.parse(args) as { headline: string; narrative: string };
}
