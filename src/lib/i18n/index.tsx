import * as React from "react";
import { EN } from "./en";

export type Lang = "es" | "en";
export const LANG_STORAGE_KEY = "flux_lang";

type Ctx = {
  lang: Lang;
  /** null = automatic detection */
  preference: Lang | null;
  setPreference: (l: Lang | null) => void;
  t: (es: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<Ctx>({
  lang: "es",
  preference: null,
  setPreference: () => {},
  t: (es) => es,
});

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function translate(lang: Lang, es: string, vars?: Record<string, string | number>) {
  const base = lang === "en" ? (EN[es] ?? es) : es;
  return interpolate(base, vars);
}

/** Detects language when the user has no explicit preference. */
async function detectLang(): Promise<Lang> {
  // 1) Browser language
  const navLang = (navigator.languages?.[0] || navigator.language || "").toLowerCase();
  if (navLang.startsWith("en")) return "en";
  if (navLang.startsWith("es")) return "es";
  // 2) Country via edge geo header
  try {
    const res = await fetch("/api/public/geo", { headers: { accept: "application/json" } });
    if (res.ok) {
      const { country } = (await res.json()) as { country?: string };
      if (country === "US") return "en";
    }
  } catch {}
  return "es";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<Lang | null>(null);
  const [detected, setDetected] = React.useState<Lang>("es");

  React.useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(LANG_STORAGE_KEY); } catch {}
    if (stored === "es" || stored === "en") {
      setPreferenceState(stored);
      return;
    }
    let alive = true;
    detectLang().then((l) => { if (alive) setDetected(l); });
    return () => { alive = false; };
  }, []);

  const setPreference = React.useCallback((l: Lang | null) => {
    setPreferenceState(l);
    try {
      if (l) localStorage.setItem(LANG_STORAGE_KEY, l);
      else localStorage.removeItem(LANG_STORAGE_KEY);
    } catch {}
    if (!l) detectLang().then(setDetected);
  }, []);

  const lang: Lang = preference ?? detected;

  React.useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const value = React.useMemo<Ctx>(
    () => ({
      lang,
      preference,
      setPreference,
      t: (es, vars) => translate(lang, es, vars),
    }),
    [lang, preference, setPreference],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return React.useContext(I18nContext);
}

/** Shorthand: const t = useT(); t("Vacantes") */
export function useT() {
  return React.useContext(I18nContext).t;
}
