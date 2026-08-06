import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  readThemePref,
  resolveTheme,
  THEME_KEY,
  type ResolvedTheme,
  type ThemePref,
} from "@/lib/theme";

type ThemeCtx = {
  theme: ThemePref;
  resolved: ResolvedTheme;
  setTheme: (next: ThemePref) => void;
};

const Ctx = createContext<ThemeCtx>({ theme: "dark", resolved: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const pref = readThemePref();
    setThemeState(pref);
    setResolved(applyTheme(pref));
  }, []);

  // Auto mode tracks the device day/night setting live.
  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolved(applyTheme("auto"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePref) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — session-only theme */
    }
    setResolved(applyTheme(next));
  }, []);

  const value = useMemo(
    () => ({ theme, resolved: resolveTheme(theme) === resolved ? resolved : resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
