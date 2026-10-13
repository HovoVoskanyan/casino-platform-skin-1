import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Category } from "./api";
import { GameArt } from "./game-art";
import { HOME_CARD, PlayMark } from "./game-card";

/**
 * The design's Quick Play artwork, by category code. A category's own thumbnail (set in the back office) wins; a
 * code the design drew falls back to its art; anything else gets the name's gradient.
 */
const DESIGN_ART: Record<string, { src: string; position?: string; tint: string; glow: string }> = {
  slots: { src: "/qp-slots.webp", tint: "bg-[#1b0a1f]", glow: "hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(240,150,10,.22)]" },
  table: { src: "/qp-blackjack.webp", tint: "bg-[#170a29]", glow: "hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(167,139,250,.24)]" },
  blackjack: { src: "/qp-blackjack.webp", tint: "bg-[#170a29]", glow: "hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(167,139,250,.24)]" },
  roulette: { src: "/qp-roulette.webp", tint: "bg-[#170a29]", glow: "hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(225,29,72,.24)]" },
  live: { src: "/qp-live-casino.webp", position: "object-[56%_14%]", tint: "bg-[#0f3b33]", glow: "hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(45,212,191,.22)]" },
};

/**
 * Design (Home Quick Play): a Hot-Games-sized tile per category — its art, its name and "N games", the gold ▶ —
 * opening the Games page filtered to it. Live categories wear the blinking LIVE tag.
 */
export function CategoryTile({ category }: { category: Category }) {
  const { t } = useTranslation();
  const art = DESIGN_ART[category.code];
  return (
    <Tile
      to={{ to: "/games", search: { category: category.code } }}
      label={t("lobby.categoryLabel", { name: category.name, count: category.gameCount })}
      tint={art?.tint}
      glow={art?.glow}
      art={category.thumbnailUrl || !art ? <GameArt name={category.name} src={category.thumbnailUrl} className="object-top" /> : <img src={art.src} alt="" loading="lazy" decoding="async" className={cn("h-full w-full object-cover", art.position ?? "object-top")} />}
      live={category.code === "live"}
      name={category.name}
      sub={t("lobby.gameCount", { count: category.gameCount })}
    />
  );
}

/** Design (Quick Play's last tile): All Games → the whole lobby. */
export function AllGamesTile() {
  const { t } = useTranslation();
  return (
    <Tile
      to={{ to: "/games" }}
      label={t("games.allGames")}
      tint="bg-[#16215c]"
      glow="hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(96,165,250,.24)]"
      art={
        <>
          <img src="/qp-all-games.webp" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
          <span aria-hidden className="absolute inset-0 bg-[radial-gradient(56%_44%_at_50%_56%,transparent_42%,rgba(8,4,20,.5)_100%)]" />
        </>
      }
      name={t("games.allGames")}
      sub={t("home.browseLobby")}
    />
  );
}

function Tile({ to, label, tint, glow, art, live = false, name, sub }: { to: { to: "/games"; search?: { category: string } }; label: string; tint?: string; glow?: string; art: ReactNode; live?: boolean; name: string; sub: string }) {
  const { t } = useTranslation();
  return (
    <Link
      {...to}
      aria-label={label}
      className={cn(
        "group relative block overflow-hidden rounded-cc-xl border border-cc-line shadow-[0_12px_30px_rgba(0,0,0,.45)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[6px] hover:border-[rgba(255,201,60,.55)]",
        HOME_CARD,
        tint ?? "bg-[#1b0a1f]",
        glow ?? "hover:shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(167,139,250,.22)]",
      )}
    >
      <div className="absolute inset-0 transition-transform duration-[400ms] group-hover:scale-[1.06]">{art}</div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[118px] bg-[linear-gradient(180deg,transparent,rgba(11,4,20,.72)_46%,rgba(9,3,16,.96))]" />
      {live ? (
        <span aria-hidden className="absolute top-[10px] left-[10px] flex h-6 items-center gap-[5px] rounded-[8px] bg-[#e11d48] px-[9px] text-[10.5px] font-extrabold tracking-[1.1px] text-white shadow-[0_4px_14px_rgba(225,29,72,.45)]">
          <span className="h-[5px] w-[5px] animate-cc-blink rounded-full bg-white" />
          {t("lobby.live")}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-[clamp(8px,2.4vw,10px)] p-[clamp(11px,3vw,14px)]">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[clamp(15px,4vw,16px)] font-extrabold leading-[1.2] text-white">{name}</span>
          <span className="text-[12px] font-medium text-[#b3a0d1]">{sub}</span>
        </span>
        <PlayMark className="h-[clamp(32px,9vw,38px)] w-[clamp(32px,9vw,38px)] text-[13px]" />
      </div>
    </Link>
  );
}
