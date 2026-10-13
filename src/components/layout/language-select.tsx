import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { LANGUAGE_NAMES, chooseLanguage, siteLanguages, subscribeSiteLanguages, type Language } from "@/i18n";

/**
 * The language switcher (owner 2026-10-13): the languages the back office switched on for this site, each in its
 * own name. The design keeps the choice as an "Account language" preference; until accounts carry one (P3-24/P3-12)
 * the choice is per browser. A site with one language shows no switcher.
 */
export function LanguageSelect({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const languages = useSyncExternalStore(subscribeSiteLanguages, siteLanguages, siteLanguages);
  if (languages.length < 2) return null;
  return (
    <label className={cn("inline-flex items-center gap-2", className)}>
      <span className={compact ? "sr-only" : "text-[13px] font-medium text-cc-lavender"}>{t("shell.language")}</span>
      <span className="relative inline-flex items-center">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 text-cc-control">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
        </svg>
        <select
          value={i18n.language}
          onChange={(e) => chooseLanguage(e.target.value as Language)}
          className="h-11 cursor-pointer appearance-none rounded-cc border border-[rgba(167,139,250,.26)] bg-white/[.04] pr-8 pl-9 text-[16px] font-semibold text-cc-text hover:bg-white/[.08] min-[600px]:text-[13.5px]"
        >
          {languages.map((l) => <option key={l} value={l} className="bg-cc-surface text-cc-ink">{LANGUAGE_NAMES[l]}</option>)}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-3 text-[10px] text-[#9c88bb]">▾</span>
      </span>
    </label>
  );
}
