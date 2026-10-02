import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/auth/session";
import { useUnreadNotices } from "./api";
import { notificationsDrawer, useNotificationsDrawer } from "./notifications-drawer";

/**
 * P3-30 — the header bell (signed-in players only), the avatar button's shape, with the unread count in support's
 * badge style (9+ above nine). Opens the notifications drawer; focus comes back here when it closes.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const unread = useUnreadNotices();
  const { open } = useNotificationsDrawer();
  if (!signedIn) return null;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={unread > 0 ? t("notifications.bellUnread", { count: unread }) : t("notifications.bell")}
      onClick={(e) => notificationsDrawer.open(e.currentTarget)}
      className={cn("relative flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-cc border border-cc-line-strong bg-white/[.04] text-cc-text hover:bg-white/[.08]", className)}
    >
      <BellGlyph />
      {unread > 0 ? (
        <span aria-hidden data-testid="notifications-unread" className="absolute -top-[6px] -right-[6px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cc-rose px-[5px] text-[10.5px] font-extrabold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}

function BellGlyph() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9zM10 19a2 2 0 004 0" />
    </svg>
  );
}
