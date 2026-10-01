import { useEffect } from "react";
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection, type RetryContext } from "@microsoft/signalr";
import { API_ORIGIN, refreshSession, reportSessionLost } from "@/api/client";
import { isUnauthorized } from "@/features/wallet/balance-connection";
import { loadConversation } from "./api";
import { supportStore, type PlayerConversation, type PlayerMessage } from "./support-store";

export const SUPPORT_HUB_PATH = "/api/v1/hubs/support";

const RECONNECT_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000];

/** Seam for tests: the real builder in the app, a fake in vitest (the balance hub's pattern). */
export const supportHubFactory = {
  create: (): HubConnection =>
    new HubConnectionBuilder()
      // Cookie mode, like the balance hub: the gateway turns `pl_access` into the Bearer on negotiate and the upgrade.
      .withUrl(API_ORIGIN + SUPPORT_HUB_PATH, { withCredentials: true })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx: RetryContext) => (isUnauthorized(ctx.retryReason) ? null : RECONNECT_MS[ctx.previousRetryCount] ?? null),
      })
      .configureLogging(LogLevel.Warning)
      .build(),
};

/**
 * P3-31 — chat's push hub, one connection for as long as a player is signed in (mounted in the root layout next to the
 * balance hub), so an agent's reply lights the Help dot even while the panel is closed. Push only: `message` (a line)
 * and `conversation` (status, unread). Every (re)connect re-reads the thread — a push missed while down heals there.
 * The reconnect rules are the balance hub's (P3-28): a 401 → ONE refresh then a fresh start, a failed refresh ends the
 * session; anything else backs off without refreshing.
 */
export function SupportConnection() {
  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connection = supportHubFactory.create();

    connection.on("message", (message: PlayerMessage) => supportStore.received([message]));
    connection.on("conversation", (conversation: PlayerConversation) => supportStore.conversation(conversation));
    connection.onreconnected(() => void loadConversation());

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
        attempt = 0;
        void loadConversation();
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
        // Down or refused: the unread dot still comes from one read; the hub keeps trying.
        if (attempt === 0) void loadConversation();
        later();
      }
    };

    connection.onclose((error) => {
      if (disposed) return;
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
      // Signed out: the next player must not see this one's thread.
      supportStore.reset();
      if (connection.state !== HubConnectionState.Disconnected) void connection.stop();
    };
  }, []);
  return null;
}
