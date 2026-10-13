import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { GameCard as Game } from "./api";
import { GameArt } from "./game-art";
import { HeartButton } from "./heart-button";

/**
 * The size of a Home rail card (Hot Games, Quick Play) — the design's formula: under 600px two cards and a peek
 * (146–172px wide, 1.6 cards on phones under 350px), height × 1.2326; from 600px cards grow from 150–172px to at most
 * 260px while the height stays 185–212px.
 */
export const HOME_CARD =
  "flex-none snap-start aspect-[172/212] w-[clamp(146px,calc((100vw-60px)/2),172px)] max-[349px]:w-[calc((100vw-28px)/1.6)] min-[600px]:aspect-auto min-[600px]:h-[clamp(185px,calc((100vw-56px)/2.1*1.2326),212px)] min-[600px]:w-auto min-[600px]:min-w-[clamp(150px,calc((100vw-56px)/2.1),172px)] min-[600px]:max-w-[260px] min-[600px]:flex-[1_0_clamp(150px,calc((100vw-56px)/2.1),172px)]";

/** Games page rails: 176px tall tiles, 156–292px wide. */
const ROW_CARD = "h-[176px] min-w-[156px] max-w-[292px] flex-[1_1_200px] snap-start";

type Variant = "rail" | "row" | "grid";

/**
 * Design (Home Hot Games / Games rails + grid): an 18px-radius tile, the art filling it, a dark fade at the foot
 * carrying name + provider and the gold ▶. Home (`rail`): the taller card, HOT/NEW ribbon top-right, 15px name.
 * Games (`row`, `grid`): 176px tiles, the ribbon top-left and the ♥ top-right, a 3-line 14px name.
 */
export function GameCardTile({ game, variant = "grid" }: { game: Game; variant?: Variant }) {
  const { t } = useTranslation();
  const badge = game.badges.includes("hot") ? "hot" : game.badges.includes("new") ? "new" : null;
  const home = variant === "rail";
  // The ♥ is a SIBLING of the card's link, not inside it (a button inside an <a> is invalid and reads as one control):
  // the link is stretched over the whole tile underneath, the ♥ sits on top of it.
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-cc-xl border border-cc-line bg-cc-card shadow-[0_12px_30px_rgba(0,0,0,.45)] transition-[transform,border-color,box-shadow] duration-200 hover:border-[rgba(255,201,60,.55)] hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(167,139,250,.22)] has-[a:focus-visible]:border-[rgba(255,201,60,.55)]",
        home ? "hover:-translate-y-[6px]" : "hover:-translate-y-1",
        variant === "rail" ? HOME_CARD : variant === "row" ? ROW_CARD : "h-[176px] w-full",
      )}
    >
      <Link to="/games/$id" params={{ id: game.id }} aria-label={t("lobby.cardLabel", { name: game.name, provider: game.providerName })} className="absolute inset-0 block rounded-cc-xl outline-none">
        <div className={cn("absolute inset-0 transition-transform duration-[400ms]", home ? "group-hover:scale-[1.07]" : "group-hover:scale-[1.05]")}>
          <GameArt name={game.name} src={game.thumbnailUrl} />
        </div>
        <span aria-hidden className={cn("absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(11,4,20,.72)_46%,rgba(9,3,16,.96))]", home ? "h-[132px]" : "h-[104px]")} />
        {badge ? (
          <span
            className={cn(
              "absolute top-0 flex h-[26px] items-center px-[11px] text-[10.5px] font-extrabold tracking-[1.2px] text-white",
              home ? "right-0 rounded-bl-[12px]" : "left-0 rounded-br-[12px]",
              badge === "hot" ? "bg-[linear-gradient(180deg,#ff4d6d,#d91e46)] shadow-[0_4px_14px_rgba(217,30,70,.45)]" : "bg-[linear-gradient(180deg,#a78bfa,#7c3aed)] shadow-[0_4px_14px_rgba(0,0,0,.35)]",
            )}
          >
            {t(`lobby.badge.${badge}`)}
          </span>
        ) : null}
        {home ? (
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-[clamp(8px,2.4vw,10px)] p-[clamp(11px,3vw,14px)]">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="line-clamp-2 text-[15px] font-extrabold leading-[1.2] tracking-[-0.1px] text-white">{game.name}</span>
              <span className="truncate text-[12px] font-medium text-[#b3a0d1]">{game.providerName}</span>
            </span>
            <PlayMark className="h-[clamp(32px,9vw,38px)] w-[clamp(32px,9vw,38px)] text-[13px]" />
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-[6px] p-[10px]">
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="line-clamp-3 text-[14px] leading-[17px] font-extrabold text-white">{game.name}</span>
              <span className="truncate text-[10.5px] leading-[15px] font-semibold text-[#cdc0e4]">{game.providerName}</span>
            </span>
            <PlayMark className="h-[34px] w-[34px] text-[12px]" />
          </div>
        )}
      </Link>
      <HeartButton game={game} className={cn("absolute top-[10px]", home ? "left-[10px]" : "right-[10px]")} />
    </div>
  );
}

/** The gold ▶ circle every lobby card ends with. */
export function PlayMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("flex flex-none items-center justify-center rounded-full bg-[image:var(--cc-gold-cta)] font-extrabold text-[#2c1400] shadow-[0_8px_20px_rgba(224,140,5,.45)]", className)}>▶</span>;
}

/** A rail/grid placeholder while the catalogue loads — the same box, so nothing jumps when it arrives. */
export function GameCardSkeleton({ variant = "grid" }: { variant?: Variant }) {
  return <div aria-hidden className={cn("animate-pulse rounded-cc-xl border border-cc-line bg-cc-surface-raised", variant === "rail" ? HOME_CARD : variant === "row" ? ROW_CARD : "h-[176px] w-full")} />;
}
