import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SupportButton } from "@/features/support/support-button";
import { LanguageSelect } from "./language-select";

const LINKS = ["responsible-gaming", "faq", "terms", "privacy"] as const;

/** The community links (owner 2026-10-16): hardcoded here, not back-office settings. Logo only (public/<key>.svg), drawn
 *  30px tall and answering a 44×44 tap area (`tap-44`), so the gaps below are the drawn gaps: 26px = 12px between tap
 *  areas in the phone column, 30px = 16px in the desktop row. */
const COMMUNITY = [
  { key: "telegram", href: "https://t.me/chochobetphl" },
  { key: "discord", href: "https://discord.gg/NCgCJZHnK" },
  { key: "zealy", href: "https://zealy.io/cw/chocho/questboard/" },
] as const;

/**
 * Design (Footer): the age badge (21+ — PAGCOR's minimum, owner 2026-10-14; the design drew 18+), Play Responsibly,
 * PAGCOR badge, the community logos, the four info links + Support, the language switcher (when the site offers more
 * than one language), and the brand phrase in Caveat. On a phone the logos stand in a column to the right of the info
 * links (the links keep their half-and-half columns through a subgrid); from md up the wrapper dissolves (`contents`)
 * and they sit in the top row before the links.
 */
export function Footer() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <footer className="mx-4 mb-[150px] flex flex-wrap items-center gap-[14px] border-t border-[rgba(167,139,250,.14)] pb-1 pt-6 md:mx-[22px] md:gap-[18px] md:pt-7">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-cc-line-strong text-[13px] font-extrabold text-[#cbb6e6]" role="img" aria-label={t("shell.ageBadgeLabel")}>{t("shell.ageBadge")}</span>
      <span className="flex flex-col gap-[3px]">
        <span className="text-[13.5px] font-bold text-cc-label">{t("shell.playResponsibly")}</span>
        <span className="text-[12px] font-medium text-cc-muted">{t("shell.gamingShouldBeFun")}</span>
      </span>
      <img src="/pagcor-licensed.png" alt={t("shell.pagcor")} className="block h-[34px] w-auto flex-none object-contain md:ml-[14px]" />
      <div className="grid w-full grid-cols-[calc(50%-8px)_1fr_auto] items-start gap-x-4 gap-y-[14px] md:contents">
        <div className="col-start-3 row-span-2 row-start-1 flex flex-col gap-[26px] pt-[7px] md:mx-auto md:flex-row md:gap-[30px] md:pt-0">
          {COMMUNITY.map(({ key, href }) => (
            <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={t(`shell.community.${key}`)} className="group tap-44 relative block rounded-full">
              <img src={`/${key}.svg`} alt="" className="block h-[30px] w-auto flex-none transition-[transform,filter] duration-150 group-hover:-translate-y-px group-hover:brightness-110 group-active:translate-y-0 group-active:scale-95" />
            </a>
          ))}
        </div>
        <div className="col-span-2 col-start-1 row-start-1 grid grid-cols-subgrid items-center gap-x-4 md:flex md:w-auto md:flex-wrap md:gap-[14px]">
          {LINKS.map((key) => {
            const on = path === `/info/${key}`;
            return (
              <Link key={key} to="/info/$page" params={{ page: key }} aria-current={on ? "page" : undefined} className={cn("flex min-h-11 items-center text-[13px] underline-offset-[5px] decoration-[rgba(255,201,60,.55)] hover:text-cc-ink pointer-fine:md:min-h-0", on ? "font-bold text-cc-ink underline" : "font-medium text-cc-lavender")}>
                {t(`info.${key}`)}
              </Link>
            );
          })}
          <SupportButton className="flex min-h-11 items-center text-[13px] font-medium text-cc-lavender hover:text-cc-ink md:min-h-0">{t("shell.support")}</SupportButton>
        </div>
        <LanguageSelect className="col-span-2 col-start-1 row-start-2 w-full md:w-auto" />
      </div>
      <span className="w-full font-brand text-[19px] font-bold leading-[1.15] text-[#f4b83d] md:ml-auto md:w-auto md:text-right" dangerouslySetInnerHTML={{ __html: `${t("shell.footerTagline")} <span style="font-size:14px;color:#ff5d7d">♥</span>` }} />
    </footer>
  );
}
