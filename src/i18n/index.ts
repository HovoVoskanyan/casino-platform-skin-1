import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";

/**
 * The ChoCho language set is closed and small (P3-22): English (Philippines) is the default, Filipino is the second.
 * Keys are dot-namespaced (nav.*, auth.*, shell.*); a language lights up by adding ./locales/<lng>.json and
 * listing it here. The account language preference (P3-12/P3-24) will drive this once it exists; until then the
 * choice is per browser.
 */
export const SUPPORTED_LANGUAGES = ["en-PH", "fil"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
const STORAGE_KEY = "chocho.lang";

function initialLanguage(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (SUPPORTED_LANGUAGES as readonly string[]).includes(v)) return v as Language;
  } catch {
    /* storage unavailable */
  }
  return "en-PH";
}

void i18n
  .use(resourcesToBackend((lng: string) => import(`./locales/${lng}.json`)))
  .use(initReactI18next)
  .init({
    lng: initialLanguage(),
    fallbackLng: "en-PH",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    keySeparator: false,
    nsSeparator: false,
  });

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lng;
});

export default i18n;
