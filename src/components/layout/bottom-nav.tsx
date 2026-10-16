import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useWheel } from "@/features/wheel/api";

const ITEMS = [
  { key: "home", to: "/", img: "nav-home" },
  { key: "games", to: "/games", img: "nav-games" },
  { key: "wallet", to: "/wallet", img: "nav-wallet" },
  { key: "bonuses", to: "/promotions", img: "nav-bonuses" },
  { key: "luckyWheel", to: "/lucky-wheel", img: "nav-wheel" },
] as const;

/** Design (Bottom Nav): fixed, 5 items in a fixed order (4 while there is no Lucky Wheel), active = gold label. 72px on phones, 82px otherwise; 54px with
 * the label beside the icon on a phone held sideways (under 500px tall), where the header stops being sticky too. */
export function BottomNav() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Lucky Wheel only while the skin has a wheel (owner 2026-10-15): hidden when bonus answers "unavailable" (none set
  // up, or switched off), and while the answer is loading or failed — never flashed. The page's own query (same key).
  // Shown anyway while the player has something there (owner 2026-10-16): free spins waiting for a game, or extra spins.
  const wheel = useWheel();
  const w = wheel.data;
  const wheelShown = !!w && (w.state !== "unavailable" || w.pendingChoices.length > 0 || w.extraSpins > 0);
  const items = wheelShown ? ITEMS : ITEMS.filter((i) => i.key !== "luckyWheel");
  return (
    <nav aria-label="Primary" className={cn("fixed bottom-[max(8px,env(safe-area-inset-bottom))] left-1/2 z-[44] grid h-[72px] w-[calc(100%-16px)] max-w-[980px] -translate-x-1/2 items-center rounded-[16px] border border-cc-line bg-[linear-gradient(180deg,rgba(35,16,63,.97)_0%,rgba(21,7,38,.97)_100%)] shadow-[0_12px_30px_rgba(0,0,0,.5)] backdrop-blur-md md:bottom-4 md:h-[82px] md:w-[calc(100%-44px)] md:rounded-cc-xl short:bottom-[max(6px,env(safe-area-inset-bottom))] short:h-[54px]", items.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
      {items.map((item) => {
        const on = item.key === "home" ? path === "/" : path.startsWith(item.to);
        return (
          <Link key={item.key} to={item.to} aria-current={on ? "page" : undefined} className="relative flex h-full min-w-[44px] flex-col items-center justify-center gap-1 px-[2px] md:gap-[7px] short:flex-row short:gap-2">
            <span className="flex h-[34px] w-9 flex-none items-center justify-center md:h-10 md:w-[42px] short:h-8 short:w-8">
              <img src={`/${item.img}.webp`} alt="" className={cn("block object-contain drop-shadow-[0_3px_7px_rgba(0,0,0,.8)]", item.key === "luckyWheel" ? "h-[34px] w-[34px] md:h-10 md:w-10 short:h-8 short:w-8" : "h-7 w-7 md:h-[34px] md:w-[34px] short:h-7 short:w-7", on ? "opacity-100 brightness-110" : "opacity-[.88]")} />
            </span>
            <span className={cn("max-w-full text-center text-[11px] font-bold leading-[1.1] tracking-[.2px] md:whitespace-nowrap md:text-[12px]", on ? "text-cc-gold" : "text-cc-lavender")}>{t(`nav.${item.key}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
