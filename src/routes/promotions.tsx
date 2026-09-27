import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PageHero, Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import { usePromotions } from "@/features/lobby/api";
import { PromotionCard, PromotionMark, usePromotionTag } from "@/features/lobby/promotion-card";
import { PromotionDialog } from "@/features/lobby/promotion-dialog";

const searchSchema = z.object({
  category: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).optional().catch(undefined),
  promo: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/promotions")({
  validateSearch: (search) => searchSchema.parse(search),
  component: PromotionsPage,
});

/**
 * Promotions (design: hero, category pills, featured promotion, all promotions, the terms dialog, how it works),
 * on core's live promotions (P3-23). The pills are the categories the live promotions actually carry — never a pill
 * that filters to nothing. The FAQ is unapproved draft copy and "My Promotions" is bonus's list: not on this card.
 */
function PromotionsPage() {
  const { t } = useTranslation();
  const tag = usePromotionTag();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/promotions" });
  const router = useRouter();
  const { data: promotions = [], isPending, isError } = usePromotions();

  const categories = [...new Set(promotions.map((p) => p.category).filter((c): c is string => Boolean(c)))];
  const shown = search.category ? promotions.filter((p) => p.category === search.category) : promotions;
  const featured = promotions[0];
  const setCategory = (category?: string) => void navigate({ search: (prev) => ({ ...prev, category }), replace: true });

  return (
    <Shell>
      <PageHero title={t("promotions.title")} subtitle={t("promotions.subtitle")} />

      {categories.length > 0 ? (
        <nav aria-label={t("promotions.categories")} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          {[undefined, ...categories].map((c) => {
            const on = search.category === c;
            return (
              <button key={c ?? "all"} type="button" aria-pressed={on} onClick={() => setCategory(c)} className={cn("flex h-10 flex-none items-center gap-2 rounded-full border px-4 text-[13.5px] font-bold whitespace-nowrap", on ? "border-[rgba(255,201,60,.6)] bg-[image:var(--cc-gold-cta)] text-[#2c1400]" : "border-cc-line bg-white/[.03] text-cc-text hover:border-cc-line-strong")}>
                {c ? tag(c) : t("promotions.all")}
              </button>
            );
          })}
        </nav>
      ) : null}

      {featured && !search.category ? (
        <section className="flex flex-col gap-4" aria-labelledby="featured">
          <span id="featured"><SectionTitle>{t("promotions.featured")}</SectionTitle></span>
          <div className="flex flex-col gap-4 overflow-hidden rounded-cc-2xl border border-[rgba(255,201,60,.3)] bg-[radial-gradient(80%_120%_at_90%_10%,rgba(255,201,60,.18),transparent_60%),linear-gradient(180deg,#2b1350_0%,#180a2c_100%)] p-5 md:flex-row md:items-center md:p-7">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-[11px] font-extrabold tracking-[1.4px] text-cc-gold">{tag(featured.category)}</span>
              <h2 className="m-0 text-[clamp(22px,4.4vw,30px)] font-extrabold leading-[1.15] tracking-[-0.5px] text-cc-ink">{featured.value ?? featured.title}</h2>
              {featured.value ? <p className="m-0 text-[15px] font-bold text-cc-text">{featured.title}</p> : null}
              {featured.body ? <p className="m-0 text-[14px] leading-[1.5] text-cc-lavender">{featured.body}</p> : null}
              <Button variant="primary" size="md" className="mt-2 self-start" onClick={() => void navigate({ search: (prev) => ({ ...prev, promo: featured.id }), state: { promoOpenedHere: true } })}>{t("promotions.viewDetails")} →</Button>
            </div>
            <div className="flex h-[140px] w-full flex-none items-center justify-center overflow-hidden rounded-cc-xl border border-cc-line bg-[rgba(9,3,16,.35)] md:h-[170px] md:w-[260px]">
              {featured.imageUrl ? <img src={featured.imageUrl} alt="" className="h-full w-full object-cover" /> : <PromotionMark category={featured.category} size={72} />}
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="all-promotions">
        <span id="all-promotions"><SectionTitle count={isPending ? undefined : t("promotions.activeCount", { count: shown.length })}>{t("promotions.allPromotions")}</SectionTitle></span>
        {isError ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}
        {!isPending && !isError && shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-cc-xl border border-cc-line bg-white/[.02] px-6 py-8 text-center">
            <span aria-hidden className="text-[22px] text-cc-gold">★</span>
            <span className="text-[16px] font-extrabold text-cc-ink">{t("promotions.emptyTitle")}</span>
            <span className="text-[13px] text-cc-lavender">{t("promotions.emptyBody")}</span>
            {search.category ? <Button size="sm" className="mt-2" onClick={() => setCategory(undefined)}>{t("promotions.showAll")}</Button> : null}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isPending ? Array.from({ length: 3 }, (_, i) => <div key={i} aria-hidden className="h-[220px] animate-pulse rounded-cc-xl border border-cc-line bg-cc-surface-raised" />) : shown.map((p) => <PromotionCard key={p.id} promotion={p} openedHere />)}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="how-it-works">
        <span id="how-it-works"><SectionTitle>{t("promotions.howItWorks")}</SectionTitle></span>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="flex flex-col gap-2 rounded-cc-xl border border-cc-line bg-white/[.02] p-4">
              <span className="text-[11px] font-extrabold tracking-[1.2px] text-[#c4b5fd]">{t("promotions.step", { n })}</span>
              <span className="text-[15px] font-extrabold text-cc-ink">{t(`promotions.step${n}.title`)}</span>
              <span className="text-[13px] leading-[1.5] text-cc-lavender">{t(`promotions.step${n}.copy`)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Opened from this page = its own history entry, so closing steps Back (and phone Back closes it too). Arrived
          with ?promo= (a hero banner, Home, a shared link): closing just drops the parameter. */}
      <PromotionDialog id={search.promo ?? null} onClose={() => (router.state.location.state.promoOpenedHere ? router.history.back() : void navigate({ search: (prev) => ({ ...prev, promo: undefined }), replace: true }))} />
    </Shell>
  );
}
