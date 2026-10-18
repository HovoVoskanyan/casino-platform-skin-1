import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { cn } from "@/lib/utils";
import type { Offer } from "./api";
import { bonusReward, offerFigures } from "./copy";
import { OfferAction } from "./offer-tile";

type Art = "welcome" | "reload" | "cashback" | "wheel";

/**
 * The owner's Promotions artwork (2026-10-18), by panel: on phones and tablets a purple panel in the offer's accent with
 * the transparent illustration beside the text; from 1024px the wide artwork-only background, the text over its empty
 * left side. `pos` keeps the artwork's subject in view as the panel crops it (the cards' art runs a little past their
 * right edge, clearing their text).
 */
const PANELS: Record<Art, { panel: string; eyebrow: string; pos: string }> = {
  welcome: { panel: "border-[rgba(167,139,250,.32)] bg-[linear-gradient(150deg,#3b1275_0%,#1f0944_55%,#160726_100%)]", eyebrow: "text-[#c4b5fd]", pos: "lg:object-right" },
  reload: { panel: "border-[rgba(232,121,249,.3)] bg-[linear-gradient(150deg,#4c1372_0%,#260a43_58%,#170726_100%)]", eyebrow: "text-[#f0abfc]", pos: "lg:-right-[6%] lg:w-[106%] lg:object-right" },
  cashback: { panel: "border-[rgba(94,234,212,.26)] bg-[linear-gradient(150deg,#123d4d_0%,#1e0c40_58%,#150726_100%)]", eyebrow: "text-[#99f6e4]", pos: "lg:-right-[6%] lg:w-[106%] lg:object-right" },
  wheel: { panel: "border-[rgba(167,139,250,.22)] bg-[linear-gradient(150deg,#2c0e58_0%,#1b0839_60%,#150726_100%)]", eyebrow: "text-[#c4b5fd]", pos: "lg:object-[right_38%]" },
};

/**
 * One panel: the text with the illustration beside it and the buttons in a row under both. From 1024px the text and
 * buttons share the panel's left `--text-w` over the artwork. One <picture>, so a phone never fetches the wide artwork nor a desktop the illustration.
 */
function Panel({ art, label, sizes, className, actions, children }: { art: Art; label: string; sizes: string; className?: string; actions: ReactNode; children: ReactNode }) {
  return (
    <article
      aria-label={label}
      className={cn(
        "relative isolate grid min-w-0 grid-cols-[minmax(0,1fr)_clamp(96px,40%,260px)] items-center gap-x-3 gap-y-4 overflow-hidden rounded-[20px] border px-4 py-5 text-cc-ink shadow-[0_18px_44px_rgba(6,3,11,.5)] [grid-template-areas:'text_art'_'actions_actions']",
        "min-[600px]:px-6 min-[600px]:py-6",
        "lg:grid-cols-[var(--text-w)_1fr] lg:content-center lg:gap-y-0 lg:bg-[#1a0838] lg:px-8 lg:py-7 lg:[grid-template-areas:'text_.'_'actions_.']",
        PANELS[art].panel,
        className,
      )}
    >
      <div className="relative z-[2] flex min-w-0 flex-col items-start [grid-area:text]">{children}</div>
      <picture className="contents">
        <source className="hidden" media="(min-width: 1024px)" srcSet={`/promo-${art}-md.webp 900w, /promo-${art}.webp 1600w`} sizes={sizes} />
        <img
          src={`/promo-${art}-art.webp`}
          alt=""
          decoding="async"
          className={cn(
            "pointer-events-none w-full object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,.5)] select-none [grid-area:art]",
            "lg:absolute lg:inset-y-0 lg:right-0 lg:z-0 lg:h-full lg:object-cover lg:drop-shadow-none lg:[grid-area:auto]",
            PANELS[art].pos,
          )}
        />
      </picture>
      <div className="relative z-[2] min-w-0 [grid-area:actions]">{actions}</div>
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[1] hidden bg-[linear-gradient(90deg,rgba(24,7,48,.88)_0%,rgba(24,7,48,.62)_34%,transparent_60%)] lg:block" />
    </article>
  );
}

/** The big figure and the words after it ("100%" / "Deposit bonus"), from the definition's own numbers. */
function figures(t: TFunction, offer: Offer) {
  const { bonus } = offer;
  const f = offerFigures(bonus);
  if (f.percent) return { big: `${f.percent}%`, kind: t(`promotions.kind.${bonus.type}`, { defaultValue: t("bonus.tile.depositBonus") }), cap: f.cap };
  if (f.spins) return { big: String(f.spins), kind: t("bonus.tile.freeSpins", { count: f.spins }), cap: null };
  return { big: "", kind: bonusReward(t, bonus), cap: null };
}

const GOLD_TEXT = "bg-[image:var(--cc-gold-cta)] bg-clip-text pr-[0.04em] text-transparent [filter:drop-shadow(0_0_16px_rgba(255,170,0,.3))]";
const EYEBROW = "m-0 text-[13px] leading-[1.3] font-extrabold tracking-[1.2px] uppercase min-[600px]:text-[14px]";

function UpTo({ cap, className }: { cap: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={cn("m-0 text-[clamp(20px,5.4vw,26px)] leading-[1.2] font-extrabold tracking-[-0.4px] text-[#cfc0ea]", className)}>
      {t("promotions.upTo")} <span className={GOLD_TEXT}>{cap}</span>
    </p>
  );
}

function AwaitingNote({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  return offer.state === "awaiting" ? <p className="m-0 mt-2 text-[13px] leading-[1.45] font-semibold text-pretty text-cc-lavender">{t("bonus.tile.activated")}</p> : null;
}

type OfferPanelProps = { offer: Offer; onView: () => void; onTerms: () => void };

/** View offer (or what the player's state offers instead) and Terms & eligibility — the offers' one dialog. */
function Actions({ offer, view, onView, onTerms, compact = false }: OfferPanelProps & { view: string; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-wrap items-center gap-y-1", compact ? "gap-x-4 lg:mt-3" : "gap-x-5 lg:mt-5")}>
      <OfferAction offer={offer} onActivate={onView} activateLabel={view} className={cn("rounded-cc-lg text-[15px] max-[599px]:flex-[1_1_100%]", compact ? "min-h-11 px-5" : "min-h-12 px-6 min-[600px]:min-w-[200px]")} />
      <button type="button" onClick={onTerms} className="relative tap-44 inline-flex min-h-11 items-center text-[14px] font-semibold text-[#ddd0f5] underline decoration-[rgba(221,208,245,.45)] underline-offset-4 hover:text-white">
        {t("promotions.termsEligibility")}
      </button>
    </div>
  );
}

/** Design (Promotions, owner 2026-10-18): the welcome offer, full width — its name, the big gold percentage, the cap. */
export function FeaturedOffer(props: OfferPanelProps) {
  const { t } = useTranslation();
  const { offer } = props;
  const { big, kind, cap } = figures(t, offer);
  return (
    <Panel art="welcome" label={offer.bonus.name} sizes="980px" className="[--text-w:46%] lg:min-h-[320px]" actions={<Actions {...props} view={t("promotions.viewWelcome")} />}>
      <h2 className={cn(EYEBROW, "min-[600px]:text-[15px]", PANELS.welcome.eyebrow)}>{offer.bonus.name}</h2>
      <p className="m-0 mt-1 flex flex-col">
        {big ? <span className={cn("text-[clamp(50px,15vw,84px)] leading-[1] font-black tracking-[-2px]", GOLD_TEXT)}>{big}</span> : null}
        <span className="text-[clamp(24px,6.6vw,40px)] leading-[1.1] font-extrabold tracking-[-0.8px] text-balance text-cc-ink">{kind}</span>
      </p>
      {cap ? <UpTo cap={cap} className="mt-2" /> : null}
      <AwaitingNote offer={offer} />
    </Panel>
  );
}

/** Design (Promotions): Weekly Reload (violet/magenta, the calendar) or Weekly Cashback (teal, the wallet). */
export function OfferCard({ art, wide, ...props }: OfferPanelProps & { art: "reload" | "cashback"; wide: boolean }) {
  const { t } = useTranslation();
  const { offer } = props;
  const { big, kind, cap } = figures(t, offer);
  return (
    <Panel
      art={art}
      label={offer.bonus.name}
      sizes={wide ? "980px" : "560px"}
      className={cn("lg:min-h-[196px] lg:px-7 lg:py-5", wide ? "[--text-w:50%] lg:col-span-2" : "[--text-w:62%]")}
      actions={<Actions {...props} view={t("promotions.viewOffer")} compact />}
    >
      <h2 className={cn(EYEBROW, PANELS[art].eyebrow)}>{offer.bonus.name}</h2>
      <p className="m-0 mt-1 text-[clamp(26px,7vw,34px)] leading-[1.12] font-extrabold tracking-[-0.8px] text-balance text-cc-ink lg:text-[28px]">
        {big ? <span className={cn("font-black", GOLD_TEXT)}>{big}</span> : null} {kind}
      </p>
      {cap ? <UpTo cap={cap} className="mt-1 lg:text-[22px]" /> : null}
      <AwaitingNote offer={offer} />
    </Panel>
  );
}

/** Design (Promotions): the Daily Lucky Wheel, lower emphasis — an outlined button to the wheel's own page. */
export function WheelPanel() {
  const { t } = useTranslation();
  const cta = (
    <Link to="/lucky-wheel" className="inline-flex min-h-12 items-center justify-center rounded-cc-lg border-2 border-cc-gold px-6 text-[15px] font-extrabold text-cc-gold transition-colors hover:bg-[rgba(255,201,60,.1)] hover:text-cc-gold-hover max-[599px]:w-full lg:mt-4">
      {t("promotions.wheel.cta")}
    </Link>
  );
  return (
    <Panel art="wheel" label={t("promotions.wheel.title")} sizes="980px" className="[--text-w:44%] lg:min-h-[220px]" actions={cta}>
      <h2 className="m-0 text-[clamp(24px,6.4vw,34px)] leading-[1.1] font-extrabold tracking-[-0.8px] text-balance text-cc-ink">{t("promotions.wheel.title")}</h2>
      <p className="m-0 mt-2 text-[15px] leading-[1.45] font-semibold text-pretty text-cc-text min-[600px]:text-[16px]">{t("promotions.wheel.body")}</p>
      <p className="m-0 mt-1 text-[13px] leading-[1.45] font-medium text-pretty text-cc-lavender">{t("promotions.wheel.note")}</p>
    </Panel>
  );
}
