import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { Notice } from "@/components/ui/notice";
import { SectionTitle } from "@/components/ui/section-title";
import { useOffers, type Offer } from "@/features/bonus/api";
import { useOfferDialog } from "@/features/bonus/offer-list";
import { OfferTile } from "@/features/bonus/offer-tile";
import { FeaturedOffer, OfferCard, WheelPanel } from "@/features/bonus/promo-panels";
import { useWheel, wheelShown } from "@/features/wheel/api";
import { useSeo } from "@/lib/seo";
import { promotionsSeo } from "@/features/lobby/page-seo";

export const Route = createFileRoute("/promotions")({ component: PromotionsPage });

/** Which panel shows an offer, by the type set in the back office: the first of each; any other offer goes under More offers. */
function arrange(list: Offer[]) {
  const welcome = list.find((o) => o.bonus.type === "welcome");
  const reload = list.find((o) => o.bonus.type === "reload");
  const cashback = list.find((o) => o.bonus.type === "cashback");
  return { welcome, reload, cashback, more: list.filter((o) => o !== welcome && o !== reload && o !== cashback) };
}

/**
 * Promotions & Rewards (owner design 2026-10-18) — the bottom nav's "Bonuses". The offers are the bonuses an operator
 * has switched on in the back office (owner 2026-10-13): Active and inside their dates, in the skin's currency. The
 * first welcome offer is the featured panel, the first reload and cashback the two cards, any other offer a tile under
 * More offers. The Daily Lucky Wheel, while the skin has one, leads the page right under the intro (owner 2026-10-20). Every button goes through the offers' one dialog
 * (the same flow as Home's tiles): View offer = Activate, Terms & eligibility = the terms.
 */
function PromotionsPage() {
  const { t } = useTranslation();
  const offers = useOffers();
  const list = offers.data ?? [];
  const dialog = useOfferDialog(list);
  const wheel = useWheel();
  useSeo(promotionsSeo(t));
  const { welcome, reload, cashback, more } = arrange(list);
  const handlers = (o: Offer) => ({ offer: o, onView: () => dialog.activate(o), onTerms: () => dialog.terms(o) });

  return (
    <Shell>
      <section className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="m-0 text-[clamp(28px,7.4vw,40px)] leading-[1.1] font-extrabold tracking-[-0.8px] text-cc-ink">{t("promotions.title")}</h1>
          {offers.data ? <span className="text-[14px] font-semibold whitespace-nowrap text-cc-lavender">{t("promotions.offerCount", { count: list.length })}</span> : null}
        </div>
        <p className="m-0 text-[15px] leading-[1.5] font-medium text-pretty text-cc-lavender">{t("promotions.intro")}</p>
      </section>

      {wheelShown(wheel.data) ? <WheelPanel /> : null}

      {offers.isError ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}
      {offers.isPending ? (
        <div aria-hidden className="flex flex-col gap-[14px]">
          <div className="h-[300px] animate-pulse rounded-[20px] border border-cc-line bg-cc-surface-raised lg:h-[320px]" />
          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
            {[0, 1].map((i) => <div key={i} className="h-[230px] animate-pulse rounded-[20px] border border-cc-line bg-cc-surface-raised lg:h-[250px]" />)}
          </div>
        </div>
      ) : null}
      {offers.data && list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-cc-xl border border-cc-line bg-white/[.02] px-6 py-8 text-center">
          <span aria-hidden className="text-[22px] text-cc-gold">★</span>
          <span className="text-[16px] font-extrabold text-cc-ink">{t("promotions.noOffersTitle")}</span>
          <span className="text-[13px] text-cc-lavender">{t("promotions.emptyBody")}</span>
        </div>
      ) : null}

      {welcome || reload || cashback ? (
        <div className="flex flex-col gap-[14px]">
          {welcome ? <FeaturedOffer {...handlers(welcome)} /> : null}
          {reload || cashback ? (
            <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
              {reload ? <OfferCard {...handlers(reload)} art="reload" wide={!cashback} /> : null}
              {cashback ? <OfferCard {...handlers(cashback)} art="cashback" wide={!reload} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {more.length ? (
        <section className="flex flex-col gap-4" aria-labelledby="more-offers">
          <span id="more-offers"><SectionTitle>{t("promotions.moreOffers")}</SectionTitle></span>
          <div className="grid grid-cols-1 gap-3 min-[364px]:grid-cols-2 min-[364px]:max-[599px]:[&>:last-child:nth-child(odd)]:col-span-2 min-[600px]:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] min-[600px]:gap-[14px]">
            {more.map((o) => <OfferTile key={o.bonus.id} offer={o} page onActivate={() => dialog.activate(o)} onTerms={() => dialog.terms(o)} />)}
          </div>
        </section>
      ) : null}

      {dialog.element}
    </Shell>
  );
}
