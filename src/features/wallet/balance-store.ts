import { useSyncExternalStore } from "react";
import { SKIN_CURRENCY } from "@/lib/money";

/**
 * P3-28 — the live balance, as core's balance hub pushes it (P6-04). The hub is not in the OpenAPI document (it is a
 * SignalR message, not a REST read — none exists), so the shape is typed here from core's records
 * (`BalanceSnapshotResponse`, `WalletAccountResponse`). All amounts are cents.
 */
export interface WalletAccount {
  currency: string;
  realCents: number;
  bonusCents: number;
  lockedCents: number;
  reservedCents: number;
  withdrawableCents: number;
  activeBonusRef: string | null;
  updatedAt: string;
}

export interface BalanceSnapshot {
  skinId: string;
  playerId: string;
  accounts: WalletAccount[];
  asOf: string;
}

/** What the header and the Wallet card show. Cash = real, bonus = bonus + locked (P3-16's map), total = both. */
export interface Balance {
  totalCents: number;
  cashCents: number;
  bonusCents: number;
  withdrawableCents: number;
}

/**
 * `unknown` until the first snapshot and again whenever the connection drops: the design's "—", never a number that
 * may have moved since (a bet placed on another device while we were offline).
 */
export type BalanceState = { status: "unknown" } | { status: "live"; balance: Balance } | { status: "failed" };

export function toBalance(snapshot: BalanceSnapshot): Balance {
  // A player with no wallet account in the skin's currency yet (never deposited, never played) holds zero — known.
  const account = snapshot.accounts.find((a) => a.currency === SKIN_CURRENCY);
  if (!account) return { totalCents: 0, cashCents: 0, bonusCents: 0, withdrawableCents: 0 };
  const bonus = account.bonusCents + account.lockedCents;
  return { totalCents: account.realCents + bonus, cashCents: account.realCents, bonusCents: bonus, withdrawableCents: account.withdrawableCents };
}

let state: BalanceState = { status: "unknown" };
const listeners = new Set<() => void>();

export const balanceStore = {
  get: () => state,
  set(next: BalanceState) {
    state = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

export function useBalance(): BalanceState {
  return useSyncExternalStore(balanceStore.subscribe, balanceStore.get, balanceStore.get);
}

/**
 * The design's ONE Hide balance setting (`chocho:balanceHidden`, "1"/"0"), shared by the header, the Wallet card and
 * the bonuses panel — hiding it in one place hides it everywhere, including other tabs.
 */
const HIDDEN_KEY = "chocho:balanceHidden";
const hiddenListeners = new Set<() => void>();
const readHidden = () => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
};

export function setBalanceHidden(hidden: boolean) {
  try {
    localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // private mode: the setting lasts for this page only
  }
  hiddenListeners.forEach((l) => l());
}

function subscribeHidden(listener: () => void) {
  hiddenListeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === HIDDEN_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    hiddenListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useBalanceHidden(): [boolean, (hidden: boolean) => void] {
  const hidden = useSyncExternalStore(subscribeHidden, readHidden, () => false);
  return [hidden, setBalanceHidden];
}
