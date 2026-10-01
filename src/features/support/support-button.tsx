import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { supportPanel, useSupportPanel, useSupportUnread } from "./support-store";

/**
 * An entry point to the support panel (Help, footer Support, the home support tile, "Contact support" links). A
 * button, not a link: it opens the one panel over the current page and is where focus returns when it closes. Wears
 * the unread dot while support has written something the player has not seen.
 */
export function SupportButton({ className, children, dot = true }: { className?: string; children: ReactNode; dot?: boolean }) {
  const unread = useSupportUnread();
  const { open } = useSupportPanel();
  return (
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={(e) => supportPanel.open(e.currentTarget)} className={cn("cursor-pointer border-0 bg-transparent p-0 text-left", className)}>
      {children}
      {dot ? <UnreadDot count={unread} className="ml-[6px]" /> : null}
    </button>
  );
}

/** The count badge: support's unread lines, while the panel is closed. */
export function UnreadDot({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <span data-testid="support-unread" className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cc-rose px-[5px] text-[10.5px] font-extrabold leading-none text-white", className)}>
      <span aria-hidden>{count > 9 ? "9+" : count}</span>
      <span className="sr-only">{t("support.unread", { count })}</span>
    </span>
  );
}
