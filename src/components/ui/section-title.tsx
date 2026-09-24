import type { ReactNode } from "react";

/** Design: 4×28px gold bar + 28/800/-0.6px title, optional grey count. */
export function SectionTitle({ children, count }: { children: ReactNode; count?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-7 w-1 flex-none rounded-full bg-cc-gold shadow-[0_0_10px_rgba(255,201,60,.6)]" />
      <h2 className="m-0 text-[28px] font-extrabold tracking-[-0.6px] text-cc-ink">{children}</h2>
      {count ? <span className="text-[13px] font-semibold text-cc-lavender">{count}</span> : null}
    </div>
  );
}
