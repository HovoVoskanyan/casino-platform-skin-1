import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Promotion } from "./api";

/** The design's per-offer marks (Promotions page). A category the design did not draw gets the star. */
const MARKS: Record<string, string> = {
  welcome: "M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9zm0 0V7h16v2M12 9v12M8.5 7a2.5 2.5 0 010-4c2 0 3.5 4 3.5 4m3.5 0a2.5 2.5 0 000-4c-2 0-3.5 4-3.5 4",
  reload: "M20 12a8 8 0 11-2.6-5.9M20 4v4h-4",
  cashback: "M6 18L18 6M8.5 8.5a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2zm7 10a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2z",
  boost: "M12 20V6m0 0l-5 5m5-5l5 5",
  "free-spins": "M12 3a9 9 0 100 18 9 9 0 000-18zm0 5.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
  vip: "M4 8l3.6 3L12 5l4.4 6L20 8l-1.6 10H5.6L4 8z",
};
const STAR = "M12 4l2.2 4.6 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5L4.8 9.3l5-.7z";

export function PromotionMark({ category, size = 26 }: { category?: string | null; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="var(--cc-gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={(category && MARKS[category]) || STAR} />
    </svg>
  );
}

/** The ribbon text: the skin's translation of the category slug, or the slug itself in capitals. */
export function usePromotionTag() {
  const { t } = useTranslation();
  return (category?: string | null) => (category ? t(`promotions.category.${category}`, { defaultValue: category.replace(/-/g, " ").toUpperCase() }) : t("promotions.tagDefault"));
}

/**
 * Design (All Promotions / Home Bonuses): the mark (or the promotion's own image), the gold ribbon, title, the value
 * line, the copy, and "View Details →", which opens the terms over the Promotions page.
 */
export function PromotionCard({ promotion, compact = false, openedHere = false }: { promotion: Promotion; compact?: boolean; openedHere?: boolean }) {
  const { t } = useTranslation();
  const tag = usePromotionTag();
  return (
    <article className={cn("flex flex-col gap-3 rounded-cc-xl border border-cc-line bg-[linear-gradient(180deg,#23103f_0%,#180a2c_100%)] p-[clamp(16px,2.2vw,20px)] shadow-[0_12px_30px_rgba(0,0,0,.35)]", compact && "w-[clamp(220px,70vw,280px)] flex-none snap-start")}>
      <div className="flex items-start gap-3">
        <span className="flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-cc-lg border border-[rgba(255,201,60,.28)] bg-[rgba(255,201,60,.08)]">
          {promotion.imageUrl ? <img src={promotion.imageUrl} alt="" className="h-full w-full object-cover" /> : <PromotionMark category={promotion.category} />}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[10.5px] font-extrabold tracking-[1.2px] text-cc-gold">{tag(promotion.category)}</span>
          <h3 className="m-0 text-[17px] font-extrabold leading-[1.25] text-cc-ink">{promotion.title}</h3>
        </span>
      </div>
      {promotion.value ? <p className="m-0 text-[20px] font-extrabold leading-[1.2] tracking-[-0.3px] text-cc-gold-hover">{promotion.value}</p> : null}
      {promotion.body ? <p className={cn("m-0 text-[13px] font-medium leading-[1.5] text-cc-lavender", compact && "line-clamp-2")}>{promotion.body}</p> : null}
      <span className="flex-1" />
      <Link to="/promotions" search={(prev) => ({ ...prev, promo: promotion.id })} state={openedHere ? { promoOpenedHere: true } : undefined} className="inline-flex h-10 items-center self-start rounded-cc border border-cc-line-strong bg-white/[.02] px-4 text-[13.5px] font-bold text-cc-text hover:bg-[rgba(167,139,250,.12)]">
        {t("promotions.viewDetails")} →
      </Link>
    </article>
  );
}
