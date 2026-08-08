"use client";

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
  defaultLocale,
  detectBrowserLocale,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "@/i18n/config";
import { catalogs, type Messages } from "@/i18n/messages";
import { GEO_LOCALE_COOKIE, parseGeoLocaleCookie } from "@/lib/geo-locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
  ready: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

function readGeoCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${GEO_LOCALE_COOKIE}=`));
  if (!match) return null;
  return parseGeoLocaleCookie(decodeURIComponent(match.split("=")[1] ?? ""));
}

async function fetchGeoLocale(): Promise<Locale | null> {
  try {
    const res = await fetch("/api/locale/geo");
    if (!res.ok) return null;
    const data = (await res.json()) as { locale?: string };
    return isLocale(data.locale) ? data.locale : null;
  } catch {
    return null;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const stored = readStoredLocale();
      if (stored) {
        if (!cancelled) {
          setLocaleState(stored);
          setReady(true);
        }
        return;
      }

      // IP / edge country → language; English if unknown
      const fromCookie = readGeoCookie();
      const fromIp = fromCookie ?? (await fetchGeoLocale());
      const next = fromIp ?? detectBrowserLocale();
      if (!cancelled) {
        setLocaleState(next);
        setReady(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore quota / private mode
    }
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: catalogs[locale],
      ready,
    }),
    [locale, setLocale, ready]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

/** Nested message tree for the active locale */
export function useT() {
  return useLocale().t;
}

export function fill(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`
  );
}
