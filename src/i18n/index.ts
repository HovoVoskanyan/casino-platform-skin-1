import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";

/**
 * The languages this site's code carries translations for: English (Philippines), the default, and Filipino.
 * Which of them a site actually offers, and which is its default, is the back office's call (owner 2026-10-13):
 * core's /api/v1/site is read before the first render and `applySiteLanguages` narrows the set. A language lights
 * up by adding ./locales/<lng>.json, listing it here, and switching it on for the site.
 */
export const SUPPORTED_LANGUAGES = ["en-PH", "fil"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** How each language names itself in the switcher. */
export const LANGUAGE_NAMES: Record<Language, string> = { "en-PH": "English", fil: "Filipino" };

const STORAGE_KEY = "chocho.lang";

/** Core stores lowercase tags (`en-ph`, `en`, `fil`); this site's files are `en-PH` and `fil`. Anything else: none. */
export function toSiteLanguage(code: string): Language | null {
  const c = code.trim().toLowerCase();
  if (c === "fil" || c === "tl" || c.startsWith("fil-")) return "fil";
  if (c === "en" || c.startsWith("en-")) return "en-PH";
  return null;
}

/** The player's own pick, kept per browser — only an explicit choice is stored, never the site's default. */
function storedChoice(): Language | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && (SUPPORTED_LANGUAGES as readonly string[]).includes(v) ? (v as Language) : null;
  } catch {
    return null;
  }
}

let offered: Language[] = [...SUPPORTED_LANGUAGES];
const listeners = new Set<() => void>();

/** The languages the switcher offers now (the site's, intersected with what this code can show). */
export const siteLanguages = () => offered;
export function subscribeSiteLanguages(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * The back office's languages for this site. A stored pick the site still offers wins; otherwise the site's default.
 * A site set to languages this code has no files for keeps English rather than showing nothing.
 */
export function applySiteLanguages(languages: string[], defaultLanguage: string) {
  const mapped = [...new Set(languages.map(toSiteLanguage).filter((l): l is Language => l !== null))];
  offered = mapped.length ? mapped : ["en-PH"];
  listeners.forEach((l) => l());
  const fallback = toSiteLanguage(defaultLanguage);
  const wanted = storedChoice() ?? (fallback && offered.includes(fallback) ? fallback : offered[0]!);
  const next = offered.includes(wanted) ? wanted : (fallback && offered.includes(fallback) ? fallback : offered[0]!);
  if (i18n.language !== next) void i18n.changeLanguage(next);
}

/** The switcher: the player's explicit choice, remembered for the next visit. */
export function chooseLanguage(lng: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* storage unavailable: the choice holds for this visit */
  }
  void i18n.changeLanguage(lng);
}

void i18n
  .use(resourcesToBackend((lng: string) => import(`./locales/${lng}.json`)))
  .use(initReactI18next)
  .init({
    lng: storedChoice() ?? "en-PH",
    fallbackLng: "en-PH",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    keySeparator: false,
    nsSeparator: false,
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
