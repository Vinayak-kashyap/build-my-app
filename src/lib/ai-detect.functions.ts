import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { DAMAGE_TYPES, SEVERITIES } from "@/lib/roadpulse";

const inputSchema = z.object({
  /** data URL or https URL of the captured road photo */
  image: z.string().min(32),
});

export type DamageDetection = {
  damage_types: string[];
  severity: string;
  confidence: number;
  summary: string;
  repair_suggestion: string;
  is_road: boolean;
};

const systemPrompt = `You are RoadPulse Vision, a civil-engineering assistant that inspects photographs of roads.
Classify visible road damage. Damage types allowed: ${DAMAGE_TYPES.join(", ")}.
Severity must be one of: ${SEVERITIES.join(", ")}. Judge severity from damage area, apparent depth,
water coverage and risk to vehicles. Confidence is 0-100. Keep the summary under 20 words and the
repair suggestion a single concrete action (e.g. cold-mix patching, full resurfacing, drainage clearing,
guardrail replacement). If the photo does not show a road surface, set is_road false and confidence low.`;

export const detectDamage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<DamageDetection> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse this road photo and report the damage." },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_damage",
              description: "Return the structured road damage assessment.",
              parameters: {
                type: "object",
                properties: {
                  damage_types: {
                    type: "array",
                    items: { type: "string", enum: [...DAMAGE_TYPES] },
                  },
                  severity: { type: "string", enum: [...SEVERITIES] },
                  confidence: { type: "number" },
                  summary: { type: "string" },
                  repair_suggestion: { type: "string" },
                  is_road: { type: "boolean" },
                },
                required: [
                  "damage_types",
                  "severity",
                  "confidence",
                  "summary",
                  "repair_suggestion",
                  "is_road",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_damage" } },
      }),
    });

    if (response.status === 429) throw new Error("Rate limit reached — try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!response.ok) throw new Error(`AI analysis failed (${response.status})`);

    const json = (await response.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no analysis");

    const parsed = JSON.parse(args) as DamageDetection;
    return {
      ...parsed,
      confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence))),
      damage_types: parsed.damage_types?.length ? parsed.damage_types : ["pothole"],
    };
  });
