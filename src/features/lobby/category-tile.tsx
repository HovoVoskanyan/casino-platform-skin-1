import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Category } from "./api";
import { GameArt } from "./game-art";

/**
 * Design (Home Quick Play): a game-card-sized tile for a category — its art (the category's thumbnail, set in the
 * back office), its name and "N games", the gold ▶ — opening the Games page filtered to it.
 */
export function CategoryTile({ category }: { category: Category }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/games"
      search={{ category: category.code }}
      aria-label={t("lobby.categoryLabel", { name: category.name, count: category.gameCount })}
      className="group relative block aspect-[172/212] w-[clamp(146px,calc((100vw-60px)/2),172px)] flex-none md:w-auto md:min-w-[172px] md:max-w-[260px] md:flex-[1_0_172px] snap-start overflow-hidden rounded-cc-xl border border-cc-line bg-[#1b0a1f] shadow-[0_12px_30px_rgba(0,0,0,.45)] transition-[transform,border-color] duration-200 hover:-translate-y-[6px] hover:border-[rgba(255,201,60,.55)]"
    >
      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.07]">
        <GameArt name={category.name} src={category.thumbnailUrl} className="object-top" />
      </div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[118px] bg-[linear-gradient(180deg,transparent,rgba(11,4,20,.72)_46%,rgba(9,3,16,.96))]" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-[clamp(11px,3vw,14px)]">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[clamp(15px,4vw,16px)] font-extrabold leading-[1.2] text-white">{category.name}</span>
          <span className="text-[12px] font-medium text-[#b3a0d1]">{t("lobby.gameCount", { count: category.gameCount })}</span>
        </span>
        <span aria-hidden className="flex h-[clamp(32px,9vw,38px)] w-[clamp(32px,9vw,38px)] flex-none items-center justify-center rounded-full bg-[image:var(--cc-gold-cta)] text-[13px] font-extrabold text-[#2c1400]">▶</span>
      </div>
    </Link>
  );
}
