import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The design's inline notice: info (violet), ok (green), error (rose). Used for form errors and service answers. */
export function Notice({ tone = "info", children, className, role }: { tone?: "info" | "ok" | "error"; children: ReactNode; className?: string; role?: string }) {
  const tones = {
    info: "border-cc-info-line bg-cc-info-soft text-cc-info-text",
    ok: "border-cc-ok-line bg-cc-ok-soft text-[#a7f3c0]",
    error: "border-cc-danger-line bg-cc-danger-soft text-[#fecaca]",
  };
  return (
    <div role={role ?? (tone === "error" ? "alert" : "status")} className={cn("flex items-start gap-[10px] rounded-cc-lg border px-[15px] py-[13px] text-[12.5px] font-semibold leading-[1.5] text-pretty", tones[tone], className)}>
      {tone === "error" ? (
        <span aria-hidden className="mt-[1px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] border-cc-danger text-[11px] font-extrabold text-cc-danger">!</span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
