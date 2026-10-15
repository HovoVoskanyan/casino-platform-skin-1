import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHero, Shell } from "@/components/layout/shell";
import { Notice } from "@/components/ui/notice";
import { SectionTitle } from "@/components/ui/section-title";
import { useOffers } from "@/features/bonus/api";
import { OfferTiles } from "@/features/bonus/offer-list";
import { useSeo } from "@/lib/seo";
import { promotionsSeo } from "@/features/lobby/page-seo";

export const Route = createFileRoute("/promotions")({ component: PromotionsPage });

/**
 * Promotions (design: hero, the offers, how it works) — the bottom nav's "Bonuses". The offers are the bonuses an
 * operator has switched on in the back office (owner 2026-10-13): Active and inside their dates, in the skin's
 * currency — the same tiles as Home's Bonuses, with Activate, Deposit to claim once activated, and the terms.
 */
function PromotionsPage() {
  const { t } = useTranslation();
  const offers = useOffers();
  const list = offers.data ?? [];
  useSeo(promotionsSeo(t));

  return (
    <Shell>
      <PageHero title={t("promotions.title")} subtitle={t("promotions.subtitle")} />

      <section className="flex flex-col gap-4" aria-labelledby="available-bonuses">
        <span id="available-bonuses"><SectionTitle count={offers.data ? t("promotions.availableCount", { count: list.length }) : undefined}>{t("promotions.available")}</SectionTitle></span>
        {offers.isError ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}
        {offers.data && list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-cc-xl border border-cc-line bg-white/[.02] px-6 py-8 text-center">
            <span aria-hidden className="text-[22px] text-cc-gold">★</span>
            <span className="text-[16px] font-extrabold text-cc-ink">{t("promotions.emptyTitle")}</span>
            <span className="text-[13px] text-cc-lavender">{t("promotions.emptyBody")}</span>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 min-[364px]:grid-cols-2 min-[364px]:max-[599px]:[&>:last-child:nth-child(odd)]:col-span-2 min-[600px]:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] min-[600px]:gap-[14px]">
          {offers.isPending ? Array.from({ length: 3 }, (_, i) => <div key={i} aria-hidden className="h-[220px] animate-pulse rounded-cc-xl border border-cc-line bg-cc-surface-raised" />) : <OfferTiles offers={list} page />}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="how-it-works">
        <span id="how-it-works"><SectionTitle>{t("promotions.howItWorks")}</SectionTitle></span>
        <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="flex flex-col gap-2 rounded-cc-xl border border-cc-line bg-white/[.02] p-4">
              <span className="text-[11px] font-extrabold tracking-[1.2px] text-[#c4b5fd]">{t("promotions.step", { n })}</span>
              <span className="text-[15px] font-extrabold text-cc-ink">{t(`promotions.step${n}.title`)}</span>
              <span className="text-[13px] leading-[1.5] text-cc-lavender">{t(`promotions.step${n}.copy`)}</span>
            </li>
          ))}
        </ol>
      </section>
    </Shell>
  );
}
