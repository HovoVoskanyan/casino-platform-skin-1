import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dismissNotice, markAllRead, useNotices, useUnreadNotices, type PlayerNotice } from "./api";
import { noticeCopy, noticeLink, noticeTime } from "./copy";

/**
 * P3-30 — the notifications drawer: the bonuses drawer's pattern and chrome (a bottom sheet under 760px, a centred
 * 620px panel above; focus in, Escape / backdrop / ✕ close it, focus back to the bell). It closes when the page
 * changes and when it unmounts on sign-out.
 */
let state: { open: boolean; returnFocus: HTMLElement | null } = { open: false, returnFocus: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const notificationsDrawer = {
  open(returnFocus?: HTMLElement | null) {
    state = { open: true, returnFocus: returnFocus ?? (document.activeElement as HTMLElement | null) };
    emit();
  },
  close() {
    if (!state.open) return;
    state = { ...state, open: false };
    emit();
  },
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

export const useNotificationsDrawer = () => useSyncExternalStore(notificationsDrawer.subscribe, notificationsDrawer.get, notificationsDrawer.get);

export function NotificationsDrawer() {
  const { t } = useTranslation();
  const { open, returnFocus } = useNotificationsDrawer();
  const path = useRouterState({ select: (s) => s.location.href });
  const shownOn = useRef(path);
  useEffect(() => {
    if (shownOn.current !== path) notificationsDrawer.close();
    shownOn.current = path;
  }, [path]);
  useEffect(() => () => notificationsDrawer.close(), []);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? notificationsDrawer.open() : notificationsDrawer.close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-[rgba(6,2,12,.76)] backdrop-blur-[5px] data-[state=open]:animate-cc-fade" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(e) => {
            if (returnFocus?.isConnected) {
              e.preventDefault();
              returnFocus.focus();
            }
          }}
          className="fixed inset-x-0 bottom-0 z-[300] flex max-h-[88vh] flex-col overflow-hidden rounded-t-[20px] bg-[linear-gradient(170deg,#2a1049_0%,#1a0930_45%,#160726_100%)] shadow-[0_30px_80px_rgba(4,1,9,.75)] outline-none data-[state=open]:animate-cc-rise min-[760px]:inset-x-auto min-[760px]:top-1/2 min-[760px]:bottom-auto min-[760px]:left-1/2 min-[760px]:max-h-[calc(100vh-48px)] min-[760px]:w-[min(620px,calc(100vw-48px))] min-[760px]:-translate-x-1/2 min-[760px]:-translate-y-1/2 min-[760px]:rounded-[20px] min-[760px]:border min-[760px]:border-[rgba(167,139,250,.26)]"
        >
          <div className="flex flex-none items-start justify-between gap-3 border-b border-[rgba(167,139,250,.14)] px-5 pt-[18px] pb-[14px]">
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[10.5px] font-extrabold tracking-[1.2px] text-cc-muted uppercase">{t("notifications.eyebrow")}</span>
              <DialogPrimitive.Title className="m-0 text-[19px] font-extrabold tracking-[-.3px] text-cc-ink">{t("notifications.title")}</DialogPrimitive.Title>
            </span>
            <DialogPrimitive.Close aria-label={t("common.close")} className="flex h-10 w-10 flex-none items-center justify-center rounded-cc border border-[rgba(167,139,250,.28)] bg-white/[.06] text-[15px] font-extrabold text-[#cbb6e6] hover:bg-white/[.14] hover:text-cc-ink">✕</DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">{t("notifications.subtitle")}</DialogPrimitive.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
            {open ? <NoticeList /> : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Mounted while the drawer is open. Opening marks everything read (`read-all`, and again for a notice pushed while it
 * is open); the items that were unread keep their highlight until the drawer closes.
 */
function NoticeList() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notices = useNotices(true);
  const unread = useUnreadNotices();
  const items = notices.data?.pages.flatMap((p) => p.items) ?? [];
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);

  // Seen unread while open — kept here, not in the cache, which read-all marks read.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  if (unreadIds.some((id) => !fresh.has(id))) setFresh(new Set([...fresh, ...unreadIds]));

  // Once the list is here (not before: a read-all racing the first page would leave its items looking unread).
  const pendingRead = notices.isSuccess && (unread > 0 || unreadIds.length > 0);
  const unreadKey = unreadIds.join();
  useEffect(() => {
    if (pendingRead) void markAllRead(qc);
  }, [pendingRead, unreadKey, unread, qc]);

  const follow = (notice: PlayerNotice) => {
    const link = noticeLink(notice);
    if (!link) return;
    notificationsDrawer.close();
    if (link.kind === "internal") void navigate({ href: link.href });
  };

  const dismiss = async (id: string) => {
    if (!(await dismissNotice(qc, id))) toast.error(t("notifications.dismissFailed"));
  };

  if (notices.isPending) {
    return (
      <div aria-label={t("notifications.loading")} className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[76px] animate-pulse rounded-[16px] bg-white/[.04]" />)}
      </div>
    );
  }
  if (notices.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[rgba(248,113,113,.4)] p-4 text-[13.5px] text-[#fecaca]">
        <span className="flex-1">{t("notifications.loadFailed")}</span>
        <Button size="sm" variant="primary" onClick={() => void notices.refetch()}>{t("common.retry")}</Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-[16px] border border-dashed border-cc-line-strong p-6 text-center">
        <strong className="text-[15px] text-cc-ink">{t("notifications.emptyTitle")}</strong>
        <span className="text-[13.5px] text-cc-lavender">{t("notifications.emptyBody")}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul role="list" aria-label={t("notifications.title")} className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((n) => (
          <NoticeItem key={n.id} notice={n} highlighted={fresh.has(n.id)} language={i18n.language} onFollow={() => follow(n)} onDismiss={() => void dismiss(n.id)} />
        ))}
      </ul>
      {notices.hasNextPage ? (
        <Button size="sm" variant="secondary" className="self-center" loading={notices.isFetchingNextPage} onClick={() => void notices.fetchNextPage()}>{t("notifications.loadMore")}</Button>
      ) : null}
    </div>
  );
}

function NoticeItem({ notice, highlighted, language, onFollow, onDismiss }: { notice: PlayerNotice; highlighted: boolean; language: string; onFollow: () => void; onDismiss: () => void }) {
  const { t, i18n } = useTranslation();
  const copy = noticeCopy(notice, t, i18n);
  const link = noticeLink(notice);
  const content = (
    <>
      <span className="flex items-center gap-2">
        {highlighted ? <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-cc-rose shadow-[0_0_8px_rgba(255,93,125,.7)]" /> : null}
        {highlighted ? <span className="sr-only">{t("notifications.new")}</span> : null}
        <strong className="min-w-0 text-[14.5px] font-extrabold text-cc-ink">{copy.title}</strong>
        {notice.category === "promo" ? (
          <span className="flex-none rounded-full border border-[rgba(255,201,60,.4)] bg-[rgba(255,201,60,.1)] px-2 py-[2px] text-[10.5px] font-extrabold tracking-[.6px] text-cc-gold uppercase">{t("notifications.promo")}</span>
        ) : null}
      </span>
      {copy.body ? <span className="text-[13.5px] whitespace-pre-wrap text-cc-text">{copy.body}</span> : null}
      <time dateTime={notice.publishedAt} className="text-[12px] text-cc-muted">{noticeTime(notice.publishedAt, t, language)}</time>
    </>
  );
  const body = "flex min-w-0 flex-1 flex-col gap-1 py-3 pl-4 text-left no-underline";
  return (
    <li data-testid="notice" data-unread={highlighted || undefined} className={cn("flex items-start gap-2 rounded-[16px] border pr-2", highlighted ? "border-[rgba(255,201,60,.38)] bg-[rgba(255,201,60,.06)]" : "border-[rgba(167,139,250,.18)] bg-white/[.03]")}>
      {link?.kind === "external" ? (
        <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={onFollow} className={cn(body, "hover:opacity-90")}>{content}</a>
      ) : link ? (
        <a href={link.href} onClick={(e) => { e.preventDefault(); onFollow(); }} className={cn(body, "hover:opacity-90")}>{content}</a>
      ) : (
        <div className={body}>{content}</div>
      )}
      <button type="button" aria-label={t("notifications.dismiss", { title: copy.title })} onClick={onDismiss} className="mt-2 flex h-9 w-9 flex-none items-center justify-center rounded-cc text-[13px] font-extrabold text-cc-muted hover:bg-white/[.08] hover:text-cc-ink">✕</button>
    </li>
  );
}
