import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SectionTitle } from "./section-title";
import { cn } from "@/lib/utils";

/**
 * Design (Home / Games rails): a section title with a gold bar, an optional count and action, then a horizontal
 * row that snaps card-by-card on phones (bleeding to the screen edge) and scrolls freely from 600px — the design's
 * one breakpoint — with ‹ › arrows that grey out at either end. The arrows scroll by one viewport of cards.
 *
 * `arrows`: Home draws 38px quiet circles, Games 44px brighter ones. `phoneGrid`: under 600px the row becomes a
 * one- or two-column grid (Home Bonuses — two columns once each gets 160px; an odd last card spans both).
 */
export function Rail({ id, title, count, action, label, arrows = "home", phoneGrid = false, children }: { id?: string; title: ReactNode; count?: string; action?: ReactNode; label: string; arrows?: "home" | "games"; phoneGrid?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft <= 2;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    // every scroll event lands here: re-render only when an arrow actually changes state
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  const step = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });
  const overflowing = !(edges.start && edges.end);

  return (
    <section id={id} className={cn("flex scroll-mt-24 flex-col", arrows === "games" ? "gap-[clamp(16px,2.4vw,22px)]" : "gap-4")} aria-label={label}>
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle count={count}>{title}</SectionTitle>
        <span className="min-w-2 flex-1" />
        {action}
        {overflowing ? (
          <div className="hidden gap-2 min-[600px]:flex">
            <ArrowButton size={arrows} label={t("lobby.previous", { name: label })} disabled={edges.start} onClick={() => step(-1)}>‹</ArrowButton>
            <ArrowButton size={arrows} label={t("lobby.next", { name: label })} disabled={edges.end} onClick={() => step(1)}>›</ArrowButton>
          </div>
        ) : null}
      </div>
      <div
        ref={ref}
        onScroll={measure}
        className={cn(
          "[scrollbar-width:none] min-[600px]:mx-[-2px] min-[600px]:-my-[6px] min-[600px]:flex min-[600px]:snap-x min-[600px]:snap-proximity min-[600px]:gap-[14px] min-[600px]:overflow-x-auto min-[600px]:overscroll-x-contain min-[600px]:px-[2px] min-[600px]:pt-[6px] min-[600px]:pb-[14px]",
          phoneGrid
            ? "grid grid-cols-1 gap-3 min-[364px]:grid-cols-2 min-[364px]:[&>:last-child:nth-child(odd)]:col-span-2"
            : "-mx-4 -my-[6px] flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pt-[6px] pb-[14px] min-[600px]:scroll-px-0",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Design (Games rails): "View all →" — quiet lavender text that lights gold, a 44px target. */
export function RailViewAll({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="-mr-2 flex h-11 items-center rounded-cc-md px-2 text-[14px] font-bold whitespace-nowrap text-[#cbb6e6] hover:bg-white/[.05] hover:text-cc-gold-hover min-[600px]:mr-0 min-[600px]:px-[15px]">
      {children} →
    </button>
  );
}

function ArrowButton({ size, label, disabled, onClick, children }: { size: "home" | "games"; label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-full border font-bold transition-[opacity,border-color,color,background-color]",
        size === "games"
          ? "h-11 w-11 border-[rgba(167,139,250,.3)] bg-white/[.055] text-[20px] leading-none text-[#ddd0f2] enabled:hover:border-[rgba(255,201,60,.6)] enabled:hover:bg-[rgba(255,201,60,.1)] enabled:hover:text-cc-gold"
          : "h-[38px] w-[38px] border-[rgba(167,139,250,.26)] bg-white/[.04] text-[16px] text-[#cbb6e6] enabled:hover:border-[rgba(255,201,60,.55)] enabled:hover:text-cc-gold",
        disabled && "cursor-default opacity-35",
      )}
    >
      {children}
    </button>
  );
}
