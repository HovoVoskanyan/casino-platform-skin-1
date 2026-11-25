import type { ReactNode } from "react";

/**
 * Design: a 4px gold-gradient bar (24→28px) + 22→28px/800/-0.6px title, optional lavender count. `as="h1"` when the
 * section names the page itself (the Games grid) — same look, the page's one H1.
 */
export function SectionTitle({ children, count, as: Heading = "h2" }: { children: ReactNode; count?: string; as?: "h1" | "h2" }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span aria-hidden className="h-[clamp(24px,5.6vw,28px)] w-1 flex-none rounded-full bg-[image:var(--cc-gold-bar)] shadow-[0_0_12px_rgba(240,150,10,.5)]" />
      <Heading className="m-0 min-w-0 text-[clamp(22px,5.6vw,28px)] font-extrabold tracking-[-0.6px] text-cc-ink">{children}</Heading>
      {count ? <span className="whitespace-nowrap text-[13px] font-semibold text-cc-lavender">{count}</span> : null}
    </div>
  );
}
