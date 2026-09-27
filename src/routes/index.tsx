import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { Rail } from "@/components/ui/rail";
import { Notice } from "@/components/ui/notice";
import { HeroCarousel } from "@/features/lobby/hero-carousel";
import { GameCardSkeleton, GameCardTile } from "@/features/lobby/game-card";
import { CategoryTile } from "@/features/lobby/category-tile";
import { PromotionCard } from "@/features/lobby/promotion-card";
import { PaymentsPanel, TrustStrip } from "@/features/lobby/home-panels";
import { useCategories, useGames, usePromotions } from "@/features/lobby/api";

export const Route = createFileRoute("/")({ component: HomePage });

/**
 * Home (design: hero carousel, Hot Games, Quick Play, Bonuses, Payments, trust strip), every section on core's
 * reads (P3-23): the `home-hero` banners, the skin's HOT games, its categories with counts, its live promotions.
 * A section whose data is empty is left out rather than framed empty. The Lucky Wheel is P5-04's.
 */
function HomePage() {
  const { t } = useTranslation();
  const hot = useGames({ badge: "hot" }, 12);
  const categories = useCategories();
  const promotions = usePromotions();
  const hotGames = hot.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Shell>
      <HeroCarousel />

      {hot.isPending || hotGames.length > 0 ? (
        <Rail title={t("home.hotGames")} label={t("home.hotGames")} action={<ViewAll to="/games" search={{ badge: "hot" }} />}>
          {hot.isPending ? Array.from({ length: 5 }, (_, i) => <GameCardSkeleton key={i} variant="rail" />) : hotGames.map((g) => <GameCardTile key={g.id} game={g} variant="rail" />)}
        </Rail>
      ) : null}
      {hot.isError ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}

      {categories.data && categories.data.length > 0 ? (
        <Rail title={t("home.quickPlay")} label={t("home.quickPlay")} action={<ViewAll to="/games" />}>
          {categories.data.map((c) => <CategoryTile key={c.code} category={c} />)}
        </Rail>
      ) : null}

      {promotions.data && promotions.data.length > 0 ? (
        <Rail title={t("home.bonuses")} label={t("home.bonuses")} action={<ViewAll to="/promotions" />}>
          {promotions.data.map((p) => <PromotionCard key={p.id} promotion={p} compact />)}
        </Rail>
      ) : null}

      <PaymentsPanel />
      <TrustStrip />
    </Shell>
  );
}

function ViewAll({ to, search }: { to: "/games" | "/promotions"; search?: Record<string, string> }) {
  const { t } = useTranslation();
  return (
    <Link to={to} search={search as never} className="flex h-9 items-center rounded-cc px-3 text-[13px] font-bold text-cc-gold hover:bg-white/[.05]">
      {t("lobby.viewAll")}
    </Link>
  );
}
