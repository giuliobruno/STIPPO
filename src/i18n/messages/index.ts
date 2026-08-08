import type { Locale } from "@/i18n/config";
import type { Messages } from "./en";
import { en } from "./en";
import { it } from "./it";
import { fr } from "./fr";
import { de } from "./de";
import { es } from "./es";
import { zh } from "./zh";

export const catalogs: Record<Locale, Messages> = {
  it,
  en,
  fr,
  de,
  es,
  zh,
};

export type { Messages };
