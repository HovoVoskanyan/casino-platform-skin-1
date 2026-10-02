import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { api, type paths } from "@/api/client";
import { toApiError } from "@/api/problem";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/features/auth/session";

/**
 * P3-30 — the player's notices from `notifications`, through the gateway on the skin's origin (cookie → bearer).
 * Server state lives in TanStack Query only: the drawer's pages and the bell's count. The hub
 * (`notifications-connection.tsx`) and the drawer's actions write into the same two cache entries.
 */
export type NoticePage = paths["/api/v1/notifications"]["get"]["responses"][200]["content"]["application/json"];
export type PlayerNotice = NoticePage["items"][number];
type Pages = InfiniteData<NoticePage, string | null>;

const PAGE_SIZE = 20;

export const notificationQueries = {
  list: () => infiniteQueryOptions({
    queryKey: queryKeys.session.notifications(),
    queryFn: async ({ pageParam }) =>
      (await api.GET("/api/v1/notifications", { params: { query: { cursor: pageParam ?? undefined, limit: PAGE_SIZE } } })).data!,
    initialPageParam: null as string | null,
    getNextPageParam: (last: NoticePage) => last.nextCursor ?? undefined,
  }),
  unread: () => queryOptions({
    queryKey: queryKeys.session.notificationsUnread(),
    queryFn: async () => (await api.GET("/api/v1/notifications/unread-count", {})).data?.unreadCount ?? 0,
  }),
};

/** The bell's count; a guest asks nothing. */
export function useUnreadNotices(): number {
  const { signedIn } = useSession();
  const { data } = useQuery({ ...notificationQueries.unread(), enabled: signedIn });
  return signedIn ? Math.max(0, data ?? 0) : 0;
}

export function useNotices(enabled: boolean) {
  return useInfiniteQuery({ ...notificationQueries.list(), enabled });
}

/** Every mutation answers the count after it; that answer is the badge. */
export const setUnread = (qc: QueryClient, unreadCount: number) =>
  qc.setQueryData(queryKeys.session.notificationsUnread(), Math.max(0, unreadCount));

const editPages = (qc: QueryClient, edit: (items: PlayerNotice[], page: number) => PlayerNotice[]) =>
  qc.setQueryData<Pages>(queryKeys.session.notifications(), (data) =>
    data ? { ...data, pages: data.pages.map((p, i) => ({ ...p, items: edit(p.items, i) })) } : data);

/** A push or a newer read: on top of the first page, once (a notice already loaded is replaced in place). */
export function prependNotice(qc: QueryClient, notice: PlayerNotice) {
  const known = qc.getQueryData<Pages>(queryKeys.session.notifications())?.pages.some((p) => p.items.some((n) => n.id === notice.id));
  editPages(qc, (items, page) =>
    known ? items.map((n) => (n.id === notice.id ? notice : n)) : page === 0 ? [notice, ...items] : items);
}

export const removeNotice = (qc: QueryClient, id: string) => editPages(qc, (items) => items.filter((n) => n.id !== id));

/** The list and the count again — a hub (re)connect heals pushes missed while it was down. */
export const resyncNotices = (qc: QueryClient) => qc.invalidateQueries({ queryKey: queryKeys.session.notificationsAll() });

let readAllInFlight: Promise<void> | null = null;

/**
 * The drawer is open: everything is seen. The loaded items take a `readAt` so a reopen does not mark them again; the
 * drawer keeps its own note of which were unread for as long as it stays open.
 */
export function markAllRead(qc: QueryClient): Promise<void> {
  readAllInFlight ??= (async () => {
    try {
      const { data } = await api.POST("/api/v1/notifications/read-all", {});
      const at = new Date().toISOString();
      editPages(qc, (items) => items.map((n) => (n.readAt ? n : { ...n, readAt: at })));
      if (data) setUnread(qc, data.unreadCount);
    } catch {
      // the badge stays; the next open tries again
    }
  })().finally(() => {
    readAllInFlight = null;
  });
  return readAllInFlight;
}

/** ✕ on an item: gone from the list (dismiss counts as read). A notice already gone (404) is dropped all the same. */
export async function dismissNotice(qc: QueryClient, id: string): Promise<boolean> {
  try {
    const { data } = await api.POST("/api/v1/notifications/{id}/dismiss", { params: { path: { id } } });
    removeNotice(qc, id);
    if (data) setUnread(qc, data.unreadCount);
    return true;
  } catch (error) {
    if (toApiError(error).status === 404) {
      removeNotice(qc, id);
      return true;
    }
    return false;
  }
}
