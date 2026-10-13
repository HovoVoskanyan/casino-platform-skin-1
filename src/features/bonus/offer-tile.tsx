import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { BonusDefinition, Offer } from "./api";
import { bonusReward, offerHeadline } from "./copy";

/** The design's four Home Bonuses looks, by bonus type (welcome violet, reload amber, cashback deep violet, spins sky). */
const THEMES: Record<string, { icon: string; card: string; glow: string; sub: string }> = {
  welcome: { icon: "/icon-gift.webp", card: "border-[rgba(167,139,250,.22)] bg-[linear-gradient(160deg,rgba(124,58,237,.26)_0%,rgba(22,9,38,.96)_58%)]", glow: "hover:shadow-[0_18px_38px_rgba(0,0,0,.5),0_0_24px_rgba(139,92,246,.22)]", sub: "text-cc-lavender" },
  reload: { icon: "/icon-coins.webp", card: "border-[rgba(235,156,13,.22)] bg-[linear-gradient(160deg,rgba(235,156,13,.22)_0%,rgba(26,11,26,.96)_58%)]", glow: "hover:shadow-[0_18px_38px_rgba(0,0,0,.5),0_0_24px_rgba(235,156,13,.22)]", sub: "text-[#c4ab8e]" },
  cashback: { icon: "/icon-percent.webp", card: "border-[rgba(167,139,250,.22)] bg-[linear-gradient(160deg,rgba(76,29,149,.3)_0%,rgba(18,8,32,.96)_58%)]", glow: "hover:shadow-[0_18px_38px_rgba(0,0,0,.5),0_0_24px_rgba(139,92,246,.2)]", sub: "text-cc-lavender" },
  freeSpins: { icon: "/icon-bolt.png", card: "border-[rgba(56,189,248,.22)] bg-[linear-gradient(160deg,rgba(14,116,190,.26)_0%,rgba(13,10,34,.96)_58%)]", glow: "hover:shadow-[0_18px_38px_rgba(0,0,0,.5),0_0_24px_rgba(56,189,248,.2)]", sub: "text-[#94a9c4]" },
};

const GOLD = "bg-[image:var(--cc-gold-cta)] text-[#2c1400] shadow-[0_8px_20px_rgba(235,156,13,.3)] hover:brightness-105";
const QUIET = "border border-[rgba(167,139,250,.3)] bg-white/[.05] text-cc-text hover:bg-white/[.1]";

/**
 * Design (Home Bonuses / Promotions): one bonus switched on in the back office — its 3D mark, name in capitals, the
 * headline in gold — ending in what the player can do now: Activate (a guest is asked to sign in first), Deposit to
 * claim once activated, In progress while it runs, Claimed when its uses are spent. "Terms" opens the full terms.
 * Two columns on phones, a rail from 600px on Home; `page` sizes it for the Promotions grid.
 */
export function OfferTile({ offer, onActivate, onTerms, page = false }: { offer: Offer; onActivate: (bonus: BonusDefinition) => void; onTerms: (bonus: BonusDefinition) => void; page?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { bonus, state } = offer;
  const theme = THEMES[bonus.type] ?? THEMES.welcome!;
  const { lead, amount } = offerHeadline(t, bonus);

  return (
    <article
      aria-label={bonus.name}
      className={cn(
        "flex min-w-0 snap-start flex-col gap-[10px] rounded-cc-xl border p-4 text-cc-ink transition-[transform,box-shadow] duration-200 hover:-translate-y-1 max-[363px]:px-4 max-[363px]:py-[14px] min-[600px]:gap-[14px] min-[600px]:p-[clamp(16px,2.2vw,20px)]",
        page ? "" : "min-[600px]:min-w-[220px] min-[600px]:flex-[1_1_220px]",
        theme.card,
        theme.glow,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-[600px]:min-h-[58px]">
        <span className="flex h-11 w-11 flex-none items-center justify-center">
          <img src={theme.icon} alt="" className="h-10 w-10 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.85)]" />
        </span>
        <span className="flex min-w-0 flex-[1_1_100px] flex-col gap-[3px]">
          <span className="text-[12.5px] leading-[1.3] font-extrabold tracking-[1px] text-white uppercase">{bonus.name}</span>
          <span className={cn("text-[12.5px] leading-[1.35] font-medium", theme.sub)}>{lead || bonusReward(t, bonus)}</span>
        </span>
      </div>
      {amount ? <span className="text-[clamp(28px,8vw,32px)] leading-[1.15] font-extrabold tracking-[-1px] break-words text-cc-gold [text-shadow:0_0_22px_rgba(255,201,60,.3)]">{amount}</span> : null}
      {state === "awaiting" ? <span className={cn("text-[12px] leading-[1.4] font-semibold", theme.sub)}>{t("bonus.tile.activated")}</span> : null}

      <div className="mt-auto flex flex-col gap-2 pt-[2px]">
        {state === "guest" || state === "claimable" ? (
          <button type="button" onClick={() => onActivate(bonus)} className={cn("flex min-h-11 items-center justify-center rounded-cc-md px-3 text-[14px] font-extrabold", GOLD)}>
            {t("bonus.tile.activate")}
          </button>
        ) : state === "awaiting" ? (
          <button type="button" onClick={() => void navigate({ to: "/wallet", hash: "deposit" })} className={cn("flex min-h-11 items-center justify-center rounded-cc-md px-3 text-[14px] font-extrabold", GOLD)}>
            {t("bonus.tile.depositToClaim")}
          </button>
        ) : state === "running" ? (
          <button type="button" onClick={() => void navigate({ to: "/account", search: { tab: "bonuses" } })} className={cn("flex min-h-11 items-center justify-center rounded-cc-md px-3 text-[13.5px] font-bold", QUIET)}>
            {t("bonus.tile.inProgress")}
          </button>
        ) : (
          <span className="flex min-h-11 items-center justify-center rounded-cc-md border border-dashed border-[rgba(167,139,250,.26)] px-3 text-[13px] font-bold text-cc-muted">{t("bonus.tile.claimed")}</span>
        )}
        <button type="button" onClick={() => onTerms(bonus)} className="flex min-h-9 items-center justify-center gap-1 self-center px-2 text-[12.5px] font-semibold text-[#cbb6e6] underline decoration-[rgba(203,182,230,.4)] underline-offset-4 hover:text-white">
          {t("bonus.viewTerms")}
        </button>
      </div>
    </article>
  );
}
