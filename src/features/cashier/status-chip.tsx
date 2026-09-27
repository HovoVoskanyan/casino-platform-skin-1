import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Chip } from "./api";

/** The design's status chip (`statusStyle`): dot + uppercase label, four tones. */
const TONES: Record<Chip, string> = {
  completed: "text-[#86efac] bg-[rgba(74,222,128,.1)] border-[rgba(74,222,128,.32)] [--dot:#4ade80]",
  pending: "text-[#ffc93c] bg-[rgba(255,201,60,.12)] border-[rgba(255,201,60,.42)] [--dot:#ffc93c]",
  failed: "text-[#fca5a5] bg-[rgba(248,113,113,.1)] border-[rgba(248,113,113,.4)] [--dot:#f87171]",
  cancelled: "text-[#c4b5fd] bg-[rgba(167,139,250,.1)] border-[rgba(167,139,250,.34)] [--dot:#a78bfa]",
};

export function StatusChip({ chip, className }: { chip: Chip; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn("inline-flex h-[26px] flex-none items-center gap-[6px] rounded-full border px-[10px] text-[11px] font-extrabold tracking-[.6px] uppercase", TONES[chip], className)}>
      <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-[var(--dot)]" />
      {t(`cashier.status.${chip}`)}
    </span>
  );
}
