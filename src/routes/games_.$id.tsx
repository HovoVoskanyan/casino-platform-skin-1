import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ApiError } from "@/api/problem";
import { useCategories, useGame } from "@/features/lobby/api";
import { GameArt } from "@/features/lobby/game-art";
import { HeartButton } from "@/features/lobby/heart-button";

export const Route = createFileRoute("/games_/$id")({ component: GamePage });

/**
 * Game detail (design: Sweet Bonanza) — art, category, name, provider, about copy, the two play modes, "Before you
 * play". A game this skin does not show (hidden, inactive, another skin's, or a made-up id) is core's 404 and reads
 * as "This game is unavailable". The play buttons are shown but DISABLED: launch exists (P6-04) but answers the
 * provider's HTML fragment and the design has no game container yet (owner question) — P3-27 does not fake it.
 */
function GamePage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const game = useGame(id);
  const { data: categories = [] } = useCategories();

  const back = (
    <Link to="/games" className="inline-flex h-10 items-center gap-1 self-start rounded-cc px-2 text-[14px] font-bold text-cc-control hover:text-cc-ink">‹ {t("game.back")}</Link>
  );

  if (game.error instanceof ApiError && game.error.status === 404) {
    return (
      <Shell>
        {back}
        <section className="flex flex-col items-center gap-3 rounded-cc-2xl border border-cc-line bg-cc-surface px-6 py-10 text-center">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border border-cc-line-strong text-[20px] font-extrabold text-cc-control">?</span>
          <h1 className="m-0 text-[22px] font-extrabold text-cc-ink">{t("game.unavailable")}</h1>
          <p className="m-0 max-w-[420px] text-[14px] text-cc-lavender">{t("game.unavailableBody")}</p>
          <Button asChild variant="primary" size="md"><Link to="/games">{t("game.back")}</Link></Button>
        </section>
      </Shell>
    );
  }

  const g = game.data;
  const categoryName = g ? categories.find((c) => g.categories.includes(c.code))?.name : undefined;

  return (
    <Shell>
      {back}
      {game.isError ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}
      {g ? (
        <section className="flex flex-col gap-5 rounded-cc-2xl border border-cc-line bg-[linear-gradient(180deg,#23103f_0%,#150726_100%)] p-4 md:flex-row md:gap-7 md:p-6">
          <div className="relative aspect-[4/3] w-full flex-none overflow-hidden rounded-cc-xl border border-cc-line md:w-[46%]">
            <GameArt name={g.name} src={g.logoUrl ?? g.thumbnailUrl} />
            <HeartButton game={g} className="absolute top-3 left-3" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              {categoryName ? <span className="text-[11px] font-extrabold tracking-[1.4px] text-cc-gold uppercase">{categoryName}</span> : null}
              <h1 className="m-0 text-[clamp(26px,5vw,34px)] font-extrabold leading-[1.1] tracking-[-0.6px] text-cc-ink">{g.name}</h1>
              <span className="text-[14px] font-semibold text-cc-lavender">{t("game.by", { provider: g.providerName })}</span>
              {g.badges.length > 0 ? (
                <span className="flex gap-2">{g.badges.map((b) => <span key={b} className="rounded-full border border-cc-line-strong px-[10px] py-[3px] text-[10.5px] font-extrabold tracking-[1.2px] text-cc-text">{t(`lobby.badge.${b}`)}</span>)}</span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="m-0 text-[15px] font-extrabold text-cc-label">{t("game.about")}</h2>
              <p className="m-0 text-[14px] leading-[1.55] text-cc-text">{g.description ?? t("game.noDescription")}</p>
              {g.rtp != null || g.volatility ? (
                <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
                  {g.rtp != null ? (<div className="flex gap-2"><dt className="text-cc-lavender">{t("game.rtp")}</dt><dd className="m-0 font-bold text-cc-ink">{g.rtp}%</dd></div>) : null}
                  {g.volatility ? (<div className="flex gap-2"><dt className="text-cc-lavender">{t("game.volatility")}</dt><dd className="m-0 font-bold text-cc-ink">{g.volatility}</dd></div>) : null}
                </dl>
              ) : null}
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-[15px] font-extrabold text-cc-label">{t("game.playMode")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.hasDemo ? (
                  <div className="flex flex-col gap-1"><Button size="lg" disabled>{t("game.playFun")}</Button><span className="text-center text-[12px] text-cc-muted">{t("game.virtualCredits")}</span></div>
                ) : null}
                <div className="flex flex-col gap-1"><Button variant="primary" size="lg" disabled>{t("game.playReal")}</Button><span className="text-center text-[12px] text-cc-muted">{t("game.realMoney")}</span></div>
              </div>
              <Notice tone="info">{t("game.launchSoon")}</Notice>
            </div>
            <div className="flex items-start gap-3 rounded-cc-lg border border-cc-line bg-white/[.02] p-4">
              <span aria-hidden className="text-cc-gold">★</span>
              <span className="flex flex-col gap-1"><span className="text-[14px] font-extrabold text-cc-ink">{t("game.beforeYouPlay")}</span><span className="text-[13px] text-cc-lavender">{t("game.beforeYouPlayBody")}</span></span>
            </div>
          </div>
        </section>
      ) : game.isPending ? (
        <div aria-hidden className="h-[420px] animate-pulse rounded-cc-2xl border border-cc-line bg-cc-surface-raised" />
      ) : null}
    </Shell>
  );
}
