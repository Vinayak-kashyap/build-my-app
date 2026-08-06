/** Locale + region preferences. Language/units are device-local; region is synced to the profile. */
export const LANGUAGE_KEY = "roadpulse.language";
export const UNITS_KEY = "roadpulse.units";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
] as const;

export const UNITS = [
  { value: "metric", label: "Metric (km, m)" },
  { value: "imperial", label: "Imperial (mi, ft)" },
] as const;

export const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Singapore",
  "United Arab Emirates",
  "Other",
] as const;

export const STATES: Record<string, string[]> = {
  India: [
    "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
    "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand",
    "West Bengal",
  ],
  "United States": [
    "California", "Florida", "Illinois", "Massachusetts", "New York", "Ohio", "Texas", "Washington",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  Canada: ["Alberta", "British Columbia", "Ontario", "Quebec"],
  Australia: ["New South Wales", "Queensland", "Victoria", "Western Australia"],
  Germany: ["Bavaria", "Berlin", "Hamburg", "North Rhine-Westphalia"],
  France: ["Auvergne-Rhône-Alpes", "Île-de-France", "Occitanie", "Provence-Alpes-Côte d'Azur"],
  Singapore: ["Central", "East", "North", "West"],
  "United Arab Emirates": ["Abu Dhabi", "Dubai", "Sharjah"],
};

export const CITY_SUGGESTIONS: Record<string, string[]> = {
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane"],
  Delhi: ["New Delhi", "Dwarka", "Rohini"],
  Karnataka: ["Bengaluru", "Mysuru", "Hubballi"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai"],
  "New York": ["New York City", "Buffalo", "Albany"],
  California: ["Los Angeles", "San Francisco", "San Diego"],
};

export function readLanguage(): string {
  if (typeof localStorage === "undefined") return "en";
  return localStorage.getItem(LANGUAGE_KEY) ?? "en";
}

export function readUnits(): "metric" | "imperial" {
  if (typeof localStorage === "undefined") return "metric";
  return localStorage.getItem(UNITS_KEY) === "imperial" ? "imperial" : "metric";
}

export function saveLocale(language: string, units: "metric" | "imperial") {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
    localStorage.setItem(UNITS_KEY, units);
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== "undefined") document.documentElement.lang = language;
}

export function formatDistance(meters: number, units = readUnits()) {
  if (units === "imperial") {
    const feet = meters * 3.28084;
    return feet < 1000 ? `${Math.round(feet)} ft` : `${(feet / 5280).toFixed(1)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
