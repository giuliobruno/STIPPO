export const locales = ["it", "en", "fr", "de", "es", "zh"] as const;
export type Locale = (typeof locales)[number];

/** Fallback when IP/geo and browser language are unknown */
export const defaultLocale: Locale = "en";

export const LOCALE_STORAGE_KEY = "stippo.locale";

export const localeLabels: Record<Locale, string> = {
  it: "Italiano",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  zh: "中文",
};

/** BCP-47 tags for SpeechRecognition */
export const speechLocale: Record<Locale, string> = {
  it: "it-IT",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  zh: "zh-CN",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && (locales as readonly string[]).includes(value));
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;
  const candidates = [
    navigator.language,
    ...(navigator.languages ?? []),
  ]
    .filter(Boolean)
    .map((l) => l.toLowerCase());

  for (const raw of candidates) {
    const base = raw.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
