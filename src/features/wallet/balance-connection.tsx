import { useEffect } from "react";
import { HttpError, HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection, type RetryContext } from "@microsoft/signalr";
import { API_ORIGIN, refreshSession, reportSessionLost } from "@/api/client";
import { balanceStore, toBalance, type BalanceSnapshot } from "./balance-store";

export const BALANCE_HUB_PATH = "/api/v1/hubs/balance";

/** SignalR's own reconnect schedule; after the last step the connection closes and we take over. */
const RECONNECT_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000];

/** Timings, as an object so a test can shorten them. */
export const balanceTiming = {
  /** A connection that delivers no snapshot within this long is treated as failed (core swallows a failed first push). */
  snapshotTimeoutMs: 10_000,
};

/** A refused negotiate: the access token expired. Retrying without a refresh cannot succeed. */
export function isUnauthorized(error: unknown): boolean {
  if (error instanceof HttpError) return error.statusCode === 401;
  return error instanceof Error && /Status code '401'|\b401\b|Unauthorized/.test(error.message);
}

/** Seam for tests: the real builder in the app, a fake in vitest. */
export const hubFactory = {
  create: (): HubConnection =>
    new HubConnectionBuilder()
      // Cookie mode: the gateway turns `pl_access` into the Bearer on negotiate AND on the upgrade. Core reads no
      // access_token query, so there is deliberately no accessTokenFactory.
      .withUrl(API_ORIGIN + BALANCE_HUB_PATH, { withCredentials: true })
      .withAutomaticReconnect({
        // A 401 ends SignalR's reconnects at once (null): only a refresh can fix it, and that is ours to do.
        nextRetryDelayInMilliseconds: (ctx: RetryContext) => (isUnauthorized(ctx.retryReason) ? null : RECONNECT_MS[ctx.previousRetryCount] ?? null),
      })
      .configureLogging(LogLevel.Warning)
      .build(),
};

/**
 * P3-28 — one hub connection for as long as a player is signed in; mounted once, in the root layout. Core sends a
 * `balance` snapshot on connect and after every wallet movement.
 * - While (re)connecting the balance is unknown ("—"), never the last number.
 * - A 401 (the 15-minute access token expired) → ONE refresh, then a fresh start. A refresh that fails means the
 *   session is over: the app's session-lost path runs and the loop stops (review S4).
 * - Any other failure → backoff, never a refresh (review B2: refreshing on every failure raced other tabs into
 *   identity's reuse detection).
 * - Connected but no snapshot within 10 s (core skips a first push when wallet is down) → failed, and try again.
 */
export function BalanceConnection() {
  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
    const connection = hubFactory.create();

    connection.on("balance", (snapshot: BalanceSnapshot) => {
      clearTimeout(snapshotTimer);
      attempt = 0;
      balanceStore.set({ status: "live", balance: toBalance(snapshot) });
    });
    connection.onreconnecting(() => balanceStore.set({ status: "unknown" }));
    connection.onreconnected(() => armSnapshotTimer());

    const armSnapshotTimer = () => {
      clearTimeout(snapshotTimer);
      snapshotTimer = setTimeout(() => {
        if (disposed || balanceStore.get().status === "live") return;
        balanceStore.set({ status: "failed" });
        void connection.stop(); // onclose schedules the next start
      }, balanceTiming.snapshotTimeoutMs);
    };

    const later = () => {
      if (disposed) return;
      const delay = Math.min(30_000, 2_000 * 2 ** attempt);
      attempt++;
      retry = setTimeout(() => void start(), delay);
    };

    /** true when the session could be renewed; false → the session is gone and the loop must stop. */
    const renew = async () => {
      if (await refreshSession()) return true;
      if (!disposed) reportSessionLost();
      return false;
    };

    const start = async () => {
      if (disposed || connection.state !== HubConnectionState.Disconnected) return;
      try {
        await connection.start();
        armSnapshotTimer();
      } catch (error) {
        if (disposed) return;
        balanceStore.set({ status: attempt >= 2 ? "failed" : "unknown" });
        if (isUnauthorized(error)) {
          if (!(await renew())) return;
          if (attempt === 0) {
            attempt++;
            void start(); // renewed: go again at once
            return;
          }
        }
        later();
      }
    };

    connection.onclose((error) => {
      if (disposed) return;
      if (balanceStore.get().status !== "failed") balanceStore.set({ status: "unknown" });
      if (isUnauthorized(error)) {
        void renew().then((ok) => ok && void start());
        return;
      }
      later();
    });

    // One tick later: a mount that is torn down at once (StrictMode's rehearsal) never opens a socket to cancel.
    const kick = setTimeout(() => void start(), 0);
    return () => {
      disposed = true;
      clearTimeout(kick);
      clearTimeout(retry);
      clearTimeout(snapshotTimer);
      balanceStore.set({ status: "unknown" });
      if (connection.state !== HubConnectionState.Disconnected) void connection.stop();
    };
  }, []);
  return null;
}
