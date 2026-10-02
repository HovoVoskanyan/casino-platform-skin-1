import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection, type RetryContext } from "@microsoft/signalr";
import { API_ORIGIN, refreshSession, reportSessionLost } from "@/api/client";
import { queryKeys } from "@/lib/queryKeys";
import { isUnauthorized } from "@/features/wallet/balance-connection";
import { prependNotice, removeNotice, resyncNotices, setUnread, type PlayerNotice } from "./api";

export const NOTIFICATIONS_HUB_PATH = "/api/v1/hubs/notifications";

const RECONNECT_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000];

/** Seam for tests: the real builder in the app, a fake in vitest (the balance and support hubs' pattern). */
export const notificationsHubFactory = {
  create: (): HubConnection =>
    new HubConnectionBuilder()
      // Cookie mode: the gateway turns `pl_access` into the Bearer on negotiate and the upgrade.
      .withUrl(API_ORIGIN + NOTIFICATIONS_HUB_PATH, { withCredentials: true })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx: RetryContext) => (isUnauthorized(ctx.retryReason) ? null : RECONNECT_MS[ctx.previousRetryCount] ?? null),
      })
      .configureLogging(LogLevel.Warning)
      .build(),
};

/**
 * P3-30 — the notifications push hub, one connection while a player is signed in (mounted in the root layout next to
 * the support hub). Push only, straight into the query cache: `notice` (a new or re-published notice → on top, the
 * count re-read), `withdrawn` (staff took it back → gone, the count re-read) and `unread` (another tab read something
 * → the badge). Every (re)connect re-reads list and count. The hub closes the connection when the access token
 * expires: the reconnect rules are the support hub's (P3-31) — a 401 → ONE refresh then a fresh start, a failed
 * refresh ends the session; anything else backs off without refreshing.
 */
export function NotificationsConnection() {
  const qc = useQueryClient();
  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connection = notificationsHubFactory.create();
    const recount = () => void qc.invalidateQueries({ queryKey: queryKeys.session.notificationsUnread() });

    connection.on("notice", (notice: PlayerNotice) => {
      prependNotice(qc, notice);
      recount();
    });
    connection.on("withdrawn", ({ id }: { id: string }) => {
      removeNotice(qc, id);
      recount();
    });
    connection.on("unread", ({ unreadCount }: { unreadCount: number }) => setUnread(qc, unreadCount));
    connection.onreconnected(() => void resyncNotices(qc));

    const later = () => {
      if (disposed) return;
      const delay = Math.min(30_000, 2_000 * 2 ** attempt);
      attempt++;
      retry = setTimeout(() => void start(), delay);
    };

    const renew = async () => {
      if (await refreshSession()) return true;
      if (!disposed) reportSessionLost();
      return false;
    };

    const start = async () => {
      if (disposed || connection.state !== HubConnectionState.Disconnected) return;
      try {
        await connection.start();
        // Not the first connect: whatever was pushed while it was down heals here.
        if (attempt > 0) void resyncNotices(qc);
        attempt = 0;
      } catch (error) {
        if (disposed) return;
        if (isUnauthorized(error)) {
          if (!(await renew())) return;
          if (attempt === 0) {
            attempt++;
            void start();
            return;
          }
        }
        // Down or refused: the bell keeps the count it read; the hub keeps trying.
        later();
      }
    };

    connection.onclose((error) => {
      if (disposed) return;
      attempt = Math.max(attempt, 1);
      if (isUnauthorized(error)) {
        void renew().then((ok) => ok && void start());
        return;
      }
      later();
    });

    const kick = setTimeout(() => void start(), 0);
    return () => {
      disposed = true;
      clearTimeout(kick);
      clearTimeout(retry);
      if (connection.state !== HubConnectionState.Disconnected) void connection.stop();
    };
  }, [qc]);
  return null;
}
