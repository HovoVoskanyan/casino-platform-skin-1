import type { HubConnection } from "@microsoft/signalr";
import { hubFactory } from "@/features/wallet/balance-connection";
import { supportHubFactory } from "@/features/support/support-connection";
import type { PlayerConversation, PlayerMessage } from "@/features/support/support-store";
import type { BalanceSnapshot, WalletAccount } from "@/features/wallet/balance-store";

/**
 * The balance hub in vitest: no socket, the test plays core. `push(...)` delivers a `balance` message; `drop()` is a
 * reconnecting connection; `close(error)` is SignalR giving up; `failNextStarts` makes `start()` reject (a refused
 * negotiate is `new Error("... Status code '401'")`). Installed for every test by setup.ts.
 */
type Handler = (...args: unknown[]) => void;

export const fakeHub = {
  handlers: new Map<string, Handler>(),
  reconnecting: null as Handler | null,
  closed: null as Handler | null,
  started: 0,
  stopped: 0,
  failNextStarts: [] as Error[],
  push(accounts: Partial<WalletAccount>[]) {
    const snapshot: BalanceSnapshot = {
      skinId: "chocho", playerId: "p1", asOf: new Date().toISOString(),
      accounts: accounts.map((a) => ({ currency: "PHP", realCents: 0, bonusCents: 0, lockedCents: 0, reservedCents: 0, withdrawableCents: 0, activeBonusRef: null, updatedAt: new Date().toISOString(), ...a })),
    };
    this.handlers.get("balance")?.(snapshot);
  },
  drop() {
    this.reconnecting?.();
  },
  close(error?: Error) {
    this.closed?.(error);
  },
  reset() {
    this.handlers.clear();
    this.reconnecting = null;
    this.closed = null;
    this.started = 0;
    this.stopped = 0;
    this.failNextStarts = [];
  },
};

/**
 * P3-31 — chat's support hub in vitest, the same kind of fake: `message(...)` / `conversation(...)` deliver chat's two
 * pushes; `reconnected()` is SignalR back after a drop (the panel re-reads the thread).
 */
export const fakeSupportHub = {
  handlers: new Map<string, Handler>(),
  reconnected: null as Handler | null,
  closed: null as Handler | null,
  started: 0,
  stopped: 0,
  failNextStarts: [] as Error[],
  message(message: PlayerMessage) {
    this.handlers.get("message")?.(message);
  },
  conversation(conversation: PlayerConversation) {
    this.handlers.get("conversation")?.(conversation);
  },
  reset() {
    this.handlers.clear();
    this.reconnected = null;
    this.closed = null;
    this.started = 0;
    this.stopped = 0;
    this.failNextStarts = [];
  },
};

function fakeConnection(hub: { handlers: Map<string, Handler>; started: number; stopped: number; failNextStarts: Error[]; closed: Handler | null }, extra: Partial<Record<"onreconnecting" | "onreconnected", (h: Handler) => void>>) {
  let state = "Disconnected";
  return {
    get state() {
      return state;
    },
    on: (name: string, handler: Handler) => void hub.handlers.set(name, handler),
    onreconnecting: extra.onreconnecting ?? (() => {}),
    onreconnected: extra.onreconnected ?? (() => {}),
    onclose: (handler: Handler) => void (hub.closed = handler),
    start: async () => {
      hub.started++;
      const failure = hub.failNextStarts.shift();
      if (failure) throw failure;
      state = "Connected";
    },
    stop: async () => {
      state = "Disconnected";
      hub.stopped++;
    },
  } as unknown as HubConnection;
}

export function installFakeHub() {
  hubFactory.create = () => fakeConnection(fakeHub, { onreconnecting: (handler) => void (fakeHub.reconnecting = handler) });
  supportHubFactory.create = () => fakeConnection(fakeSupportHub, { onreconnected: (handler) => void (fakeSupportHub.reconnected = handler) });
}
