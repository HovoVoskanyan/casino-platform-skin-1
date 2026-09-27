import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SectionTitle } from "./section-title";
import { cn } from "@/lib/utils";

/**
 * Design (Home / Games rails): a section title with a gold bar, an optional count and "View all", then a horizontal
 * row that snaps card-by-card on phones (bleeding to the screen edge) and scrolls freely on desktop with ‹ › arrows
 * that grey out at either end. The arrows scroll by one viewport of cards.
 */
export function Rail({ title, count, action, label, children }: { title: ReactNode; count?: string; action?: ReactNode; label: string; children: ReactNode }) {
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

  return (
    <section className="flex flex-col gap-4" aria-label={label}>
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle count={count}>{title}</SectionTitle>
        <span className="min-w-2 flex-1" />
        {action}
        <div className="hidden gap-2 md:flex">
          <ArrowButton label={t("lobby.previous", { name: label })} disabled={edges.start} onClick={() => step(-1)}>‹</ArrowButton>
          <ArrowButton label={t("lobby.next", { name: label })} disabled={edges.end} onClick={() => step(1)}>›</ArrowButton>
        </div>
      </div>
      <div
        ref={ref}
        onScroll={measure}
        className="-mx-4 -my-[6px] flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pt-[6px] pb-[14px] [scrollbar-width:none] md:mx-[-2px] md:snap-proximity md:scroll-px-0 md:gap-[14px] md:px-[2px]"
      >
        {children}
      </div>
    </section>
  );
}

function ArrowButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={cn("flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[rgba(167,139,250,.26)] bg-white/[.04] text-[16px] font-bold text-[#cbb6e6] transition-opacity hover:border-[rgba(255,201,60,.55)] hover:text-cc-gold", disabled && "cursor-default opacity-35")}>
      {children}
    </button>
  );
}
