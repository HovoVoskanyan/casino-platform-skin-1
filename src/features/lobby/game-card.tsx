import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { GameCard as Game } from "./api";
import { GameArt } from "./game-art";
import { HeartButton } from "./heart-button";

/**
 * Design (Hot Games / Games grid): an 18px-radius tile, the art filling it, a dark fade at the foot carrying name +
 * provider and the gold ▶, a HOT (rose) or NEW (violet) ribbon top-right, the ♥ top-left. `rail` fixes the width
 * the design gives rail cards; the grid lets the column decide.
 */
export function GameCardTile({ game, variant = "grid" }: { game: Game; variant?: "rail" | "grid" }) {
  const { t } = useTranslation();
  const badge = game.badges.includes("hot") ? "hot" : game.badges.includes("new") ? "new" : null;
  // The ♥ is a SIBLING of the card's link, not inside it (a button inside an <a> is invalid and reads as one control):
  // the link is stretched over the whole tile underneath, the ♥ sits on top of it.
  return (
    <div
      className={cn(
        "group relative flex-none snap-start overflow-hidden rounded-cc-xl border border-cc-line bg-cc-card shadow-[0_12px_30px_rgba(0,0,0,.45)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[6px] hover:border-[rgba(255,201,60,.55)] hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(167,139,250,.22)] has-[a:focus-visible]:border-[rgba(255,201,60,.55)]",
        variant === "rail" ? "aspect-[172/212] w-[clamp(146px,calc((100vw-60px)/2),172px)] md:w-auto md:min-w-[172px] md:max-w-[260px] md:flex-[1_0_172px]" : "aspect-[172/212] w-full",
      )}
    >
      <Link to="/games/$id" params={{ id: game.id }} aria-label={t("lobby.cardLabel", { name: game.name, provider: game.providerName })} className="absolute inset-0 block rounded-cc-xl outline-none">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.07]">
          <GameArt name={game.name} src={game.thumbnailUrl} />
        </div>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[132px] bg-[linear-gradient(180deg,transparent,rgba(11,4,20,.72)_46%,rgba(9,3,16,.96))]" />
        {badge ? (
          <span className={cn("absolute top-0 right-0 flex h-[26px] items-center rounded-bl-[12px] px-[11px] text-[10.5px] font-extrabold tracking-[1.2px] text-white", badge === "hot" ? "bg-[linear-gradient(180deg,#ff4d6d,#d91e46)] shadow-[0_4px_14px_rgba(217,30,70,.45)]" : "bg-[linear-gradient(180deg,#8b5cf6,#6d28d9)] shadow-[0_4px_14px_rgba(109,40,217,.45)]")}>
            {t(`lobby.badge.${badge}`)}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-[clamp(11px,3vw,14px)]">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="line-clamp-2 text-[15px] font-extrabold leading-[1.2] tracking-[-0.1px] text-white">{game.name}</span>
            <span className="truncate text-[12px] font-medium text-[#b3a0d1]">{game.providerName}</span>
          </span>
          <span aria-hidden className="flex h-[clamp(32px,9vw,38px)] w-[clamp(32px,9vw,38px)] flex-none items-center justify-center rounded-full bg-[image:var(--cc-gold-cta)] text-[13px] font-extrabold text-[#2c1400] shadow-[0_8px_20px_rgba(224,140,5,.45)]">▶</span>
        </div>
      </Link>
      <HeartButton game={game} className="absolute top-[10px] left-[10px]" />
    </div>
  );
}

/** A rail/grid placeholder while the catalogue loads — the same box, so nothing jumps when it arrives. */
export function GameCardSkeleton({ variant = "grid" }: { variant?: "rail" | "grid" }) {
  return <div aria-hidden className={cn("flex-none animate-pulse rounded-cc-xl border border-cc-line bg-cc-surface-raised", variant === "rail" ? "aspect-[172/212] w-[clamp(146px,calc((100vw-60px)/2),172px)] md:w-auto md:min-w-[172px] md:max-w-[260px] md:flex-[1_0_172px]" : "aspect-[172/212] w-full")} />;
}
