import type { HubConnection } from "@microsoft/signalr";
import { hubFactory } from "@/features/wallet/balance-connection";
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

export function installFakeHub() {
  hubFactory.create = () => {
    let state = "Disconnected";
    return {
      get state() {
        return state;
      },
      on: (name: string, handler: Handler) => void fakeHub.handlers.set(name, handler),
      onreconnecting: (handler: Handler) => void (fakeHub.reconnecting = handler),
      onreconnected: () => {},
      onclose: (handler: Handler) => void (fakeHub.closed = handler),
      start: async () => {
        fakeHub.started++;
        const failure = fakeHub.failNextStarts.shift();
        if (failure) throw failure;
        state = "Connected";
      },
      stop: async () => {
        state = "Disconnected";
        fakeHub.stopped++;
      },
    } as unknown as HubConnection;
  };
}
