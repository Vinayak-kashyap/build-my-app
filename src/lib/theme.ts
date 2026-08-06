/** Theme preference: dark, light, or auto (follows the device day/night setting). */
export type ThemePref = "dark" | "light" | "auto";
export type ResolvedTheme = "dark" | "light";

export const THEME_KEY = "roadpulse.theme";

export const THEME_OPTIONS: { value: ThemePref; label: string; hint: string }[] = [
  { value: "dark", label: "Dark (Night)", hint: "High-contrast, best for driving at night" },
  { value: "light", label: "Bright (Day)", hint: "Readable in direct sunlight" },
  { value: "auto", label: "Auto — follow device", hint: "Switches with your system day/night setting" },
];

export function readThemePref(): ThemePref {
  if (typeof localStorage === "undefined") return "dark";
  const raw = localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "auto" || raw === "dark" ? raw : "dark";
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "auto" ? systemTheme() : pref;
}

export function applyTheme(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0d1117" : "#f5f7fa");
  return resolved;
}

/** Inline boot script — applies the stored theme before first paint (no flash). */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'dark';var r=p==='auto'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var e=document.documentElement;e.classList.toggle('dark',r==='dark');e.classList.toggle('light',r==='light');e.style.colorScheme=r;}catch(_){}})();`;
