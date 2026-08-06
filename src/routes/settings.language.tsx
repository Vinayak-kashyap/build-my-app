import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { saveProfile } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import {
  CITY_SUGGESTIONS,
  COUNTRIES,
  LANGUAGES,
  STATES,
  UNITS,
  readLanguage,
  readUnits,
  saveLocale,
} from "@/lib/locale";

export const Route = createFileRoute("/settings/language")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Language & Region — RoadPulse" },
      {
        name: "description",
        content:
          "Set your app language, measurement units and home region so alerts and leaderboards match your area.",
      },
      { property: "og:title", content: "Language & Region — RoadPulse" },
      { property: "og:description", content: "Language, units and home region preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LanguageSettings,
});

function LanguageSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [language, setLanguage] = useState("en");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [country, setCountry] = useState<string>("India");
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLanguage(readLanguage());
    setUnits(readUnits());
    if (!user) {
      setLoading(false);
      return;
    }
    void supabase
      .from("profiles")
      .select("region, state, city")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.region) setCountry(data.region);
        setState(data?.state ?? "");
        setCity(data?.city ?? "");
        setLoading(false);
      });
  }, [user]);

  const stateOptions = STATES[country] ?? [];
  const cityOptions = CITY_SUGGESTIONS[state] ?? [];

  async function onSave() {
    setSaving(true);
    try {
      saveLocale(language, units);
      if (user) {
        await saveProfile(user.id, {
          region: country,
          state: state || null,
          city: city || null,
        });
      }
      toast.success("Language & region saved");
      navigate({ to: "/profile" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "tap-target mt-2 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground";

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          aria-label="Back"
          onClick={() => navigate({ to: "/profile" })}
          className="tap-target flex items-center justify-center rounded-full text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Language & Region</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : (
        <section className="space-y-5 px-4 py-5">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
            <Globe className="mt-0.5 h-4 w-4 text-accent" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              Your region drives city/state leaderboards, prediction digests and which authority
              jurisdiction receives your reports.
            </p>
          </div>

          <div>
            <label htmlFor="lang" className="text-sm font-semibold text-foreground">
              App language
            </label>
            <select
              id="lang"
              className={selectClass}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="units" className="text-sm font-semibold text-foreground">
              Distance units
            </label>
            <select
              id="units"
              className={selectClass}
              value={units}
              onChange={(e) => setUnits(e.target.value as "metric" | "imperial")}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="country" className="text-sm font-semibold text-foreground">
              Country / Region
            </label>
            <select
              id="country"
              className={selectClass}
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setState("");
                setCity("");
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="state" className="text-sm font-semibold text-foreground">
              State / Province
            </label>
            {stateOptions.length > 0 ? (
              <select
                id="state"
                className={selectClass}
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setCity("");
                }}
              >
                <option value="">Select a state</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="state"
                className={selectClass}
                value={state}
                placeholder="Enter your state or province"
                onChange={(e) => setState(e.target.value)}
              />
            )}
          </div>

          <div>
            <label htmlFor="city" className="text-sm font-semibold text-foreground">
              City
            </label>
            <input
              id="city"
              list="city-options"
              className={selectClass}
              value={city}
              placeholder="Enter your city"
              onChange={(e) => setCity(e.target.value)}
            />
            <datalist id="city-options">
              {cityOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <button
            onClick={() => void onSave()}
            disabled={saving}
            className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save preferences
          </button>
        </section>
      )}
    </main>
  );
}
