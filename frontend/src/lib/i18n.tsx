"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "zh";

const STORAGE_KEY = "openclaw_locale";
const DEFAULT_LOCALE: Locale = "en";

// ---------------------------------------------------------------------------
// Translation dictionaries (en / zh)
// ---------------------------------------------------------------------------

import enMessages from "../../messages/en.json";
import zhMessages from "../../messages/zh.json";

const messages: Record<Locale, Record<string, string>> = {
  en: enMessages as Record<string, string>,
  zh: zhMessages as Record<string, string>,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "zh") {
        setLocaleState(stored);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = messages[locale];
      let text = dict[key] ?? messages["en"][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return text;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

/** Shorthand: just returns the `t` function. */
export function useT(): I18nContextValue["t"] {
  return useI18n().t;
}
