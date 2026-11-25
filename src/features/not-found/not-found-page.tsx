import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHero, Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Rail } from "@/components/ui/rail";
import { useOffers } from "@/features/bonus/api";
import { OfferTiles } from "@/features/bonus/offer-list";
import { GameCardSkeleton, GameCardTile } from "@/features/lobby/game-card";
import { useGames } from "@/features/lobby/api";
import { notFoundSeo } from "@/features/lobby/page-seo";
import { useSeo } from "@/lib/seo";
import { missingKind, type Missing } from "./missing";

const PRIMARY: Record<Missing, { to: "/promotions" | "/games" | "/"; label: string }> = {
  promotion: { to: "/promotions", label: "notFound.cta.promotions" },
  game: { to: "/games", label: "notFound.cta.games" },
  page: { to: "/", label: "notFound.cta.home" },
};

/**
 * The not-found page (owner 2026-11-25): any address the router has no page for, and a game the skin does not show.
 * It says what is gone in the words of what the address pointed at — an ended promotion, a retired game, a page —
 * then shows what is live in its place: the offers running now and the hot games, the closer of the two first, and
 * plain links to the main sections. Kept out of the index (the server answers 404 with the same tags, from
 * `seo/head.gotmpl`); every way on is a real link, so a crawler that lands here follows on to live pages.
 */
export function NotFoundPage({ missing }: { missing?: Missing }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const kind = missing ?? missingKind(pathname);
  useSeo(notFoundSeo(t, kind));
  const offers = useOffers();
  const hot = useGames({ badge: "hot" }, 12);
  const hotGames = hot.data?.pages.flatMap((p) => p.items) ?? [];
  const primary = PRIMARY[kind];

  const offersRail = offers.data && offers.data.length > 0 ? (
    <Rail key="offers" title={t("notFound.runningNow")} label={t("notFound.runningNow")} phoneGrid>
      <OfferTiles offers={offers.data} />
    </Rail>
  ) : null;
  const gamesRail = hot.isPending || hotGames.length > 0 ? (
    <Rail key="games" title={t("home.hotGames")} label={t("home.hotGames")}>
      {hot.isPending ? Array.from({ length: 5 }, (_, i) => <GameCardSkeleton key={i} variant="rail" />) : hotGames.map((g) => <GameCardTile key={g.id} game={g} variant="rail" />)}
    </Rail>
  ) : null;

  return (
    <Shell>
      <PageHero title={t(`notFound.${kind}.title`)} subtitle={t(`notFound.${kind}.body`)}>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="inline-flex h-10 items-center rounded-full border border-[rgba(255,201,60,.35)] bg-[rgba(255,201,60,.08)] px-3 text-[13px] font-extrabold tracking-[1.5px] text-cc-gold">404</span>
          <Button asChild variant="primary" size="md"><Link to={primary.to}>{t(primary.label)}</Link></Button>
          {kind === "page" ? null : <Button asChild variant="secondary" size="md"><Link to="/">{t("notFound.cta.home")}</Link></Button>}
        </div>
      </PageHero>

      {kind === "promotion" ? [offersRail, gamesRail] : [gamesRail, offersRail]}

      <nav aria-label={t("notFound.explore")} className="flex flex-col gap-3">
        <span className="text-[13px] font-bold tracking-[.4px] text-cc-lavender uppercase">{t("notFound.explore")}</span>
        <ul className="m-0 grid list-none grid-cols-2 gap-[10px] p-0 min-[600px]:grid-cols-4">
          {([["/games", "nav.games"], ["/promotions", "nav.promotions"], ["/vip", "nav.vip"], ["/", "nav.home"]] as const).map(([to, label]) => (
            <li key={to}>
              <Link to={to} className="flex h-12 items-center justify-between rounded-cc-lg border border-cc-line bg-cc-surface px-4 text-[14px] font-bold text-cc-ink hover:border-cc-line-strong hover:bg-cc-surface-raised">
                {t(label)}<span aria-hidden className="text-cc-gold">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Shell>
  );
}
