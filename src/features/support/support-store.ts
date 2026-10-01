import { useSyncExternalStore } from "react";
import type { components } from "@/api/schema";

/**
 * P3-31 — the player's support thread, as chat's REST reads and its push hub (`/api/v1/hubs/support`) deliver it. One
 * store for the whole app: the hub connection (mounted while signed in) writes into it even while the panel is closed,
 * so the Help / Support entries can show the unread dot, and the panel opens on what is already here.
 *
 * Lines are merged by id (a player's own line comes back on the POST answer AND on the hub). A line being sent lives
 * in `pending` under its `clientMessageId` until the server's copy of it arrives by either road.
 */
export type PlayerMessage = components["schemas"]["PlayerMessageResponse"];
export type PlayerConversation = components["schemas"]["PlayerConversationResponse"];
export type CannedQuestion = components["schemas"]["CannedQuestionResponse"];

/** Why a line did not go: chat's 429 / 400 / 404 (a canned question since removed), or no answer at all. */
export type SendFailure = "RATE_LIMITED" | "VALIDATION_FAILED" | "GONE" | "NETWORK";

export interface PendingLine {
  clientMessageId: string;
  body: string;
  cannedAnswerId: string | null;
  status: "sending" | "failed";
  failure?: SendFailure;
}

export interface ThreadState {
  status: "idle" | "loading" | "ready" | "failed";
  conversation: PlayerConversation | null;
  /** Oldest first, unique by id. */
  messages: PlayerMessage[];
  hasMore: boolean;
  loadingOlder: boolean;
  pending: PendingLine[];
}

const EMPTY: ThreadState = { status: "idle", conversation: null, messages: [], hasMore: false, loadingOlder: false, pending: [] };

let state: ThreadState = EMPTY;
/** Bumped by reset (sign-out): an answer to a request made for the previous player is dropped, never merged. */
let epoch = 0;
const listeners = new Set<() => void>();
const set = (next: ThreadState) => {
  state = next;
  listeners.forEach((l) => l());
};

const byTime = (a: PlayerMessage, b: PlayerMessage) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Union by id, oldest first. */
export function mergeMessages(current: PlayerMessage[], incoming: PlayerMessage[]): PlayerMessage[] {
  if (incoming.length === 0) return current;
  const seen = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) seen.set(m.id, m);
  return [...seen.values()].sort(byTime);
}

/** Drop the pending lines the server now holds (matched by clientMessageId). */
const settle = (pending: PendingLine[], arrived: PlayerMessage[]) => {
  const ids = new Set(arrived.map((m) => m.clientMessageId).filter(Boolean));
  return ids.size ? pending.filter((p) => !ids.has(p.clientMessageId)) : pending;
};

export const supportStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  reset() {
    epoch++;
    set(EMPTY);
  },
  epoch: () => epoch,
  loading() {
    // A refresh over a thread already shown keeps it on screen; only a first load shows "loading".
    if (state.status !== "ready") set({ ...state, status: "loading" });
  },
  failed() {
    if (state.status !== "ready") set({ ...state, status: "failed" });
  },
  /**
   * The latest page (`GET /conversation`): the first load, and every resync after a reconnect. It is merged into what
   * is loaded — unless it does not reach it (more new lines than a page while we were away), then it replaces it, so
   * the list never holds a silent gap.
   */
  opened(conversation: PlayerConversation | null, messages: PlayerMessage[], hasMore: boolean) {
    const known = new Set(state.messages.map((m) => m.id));
    const joins = state.messages.length === 0 || !hasMore || messages.some((m) => known.has(m.id));
    set({
      ...state,
      status: "ready",
      conversation,
      messages: joins ? mergeMessages(state.messages, messages) : [...messages].sort(byTime),
      // Joined onto a thread already read from the server: how far back it goes is what WE loaded, not this page.
      hasMore: joins && state.status === "ready" && state.messages.length > 0 ? state.hasMore : hasMore,
      pending: settle(state.pending, messages),
    });
  },
  olderLoading(loading: boolean) {
    set({ ...state, loadingOlder: loading });
  },
  older(messages: PlayerMessage[], hasMore: boolean) {
    set({ ...state, loadingOlder: false, messages: mergeMessages(state.messages, messages), hasMore });
  },
  /** A line from the hub or from a send's answer. */
  received(messages: PlayerMessage[]) {
    set({ ...state, messages: mergeMessages(state.messages, messages), pending: settle(state.pending, messages) });
  },
  conversation(conversation: PlayerConversation | null) {
    set({ ...state, conversation });
  },
  markedRead() {
    if (state.conversation) set({ ...state, conversation: { ...state.conversation, unread: 0 } });
  },
  sending(line: Omit<PendingLine, "status" | "failure">) {
    const rest = state.pending.filter((p) => p.clientMessageId !== line.clientMessageId);
    set({ ...state, pending: [...rest, { ...line, status: "sending" }] });
  },
  sendFailed(clientMessageId: string, failure: SendFailure) {
    set({ ...state, pending: state.pending.map((p) => (p.clientMessageId === clientMessageId ? { ...p, status: "failed", failure } : p)) });
  },
  discard(clientMessageId: string) {
    set({ ...state, pending: state.pending.filter((p) => p.clientMessageId !== clientMessageId) });
  },
};

export function useSupportThread(): ThreadState {
  return useSyncExternalStore(supportStore.subscribe, supportStore.get, supportStore.get);
}

/**
 * The one panel for every entry point (design: Help, footer Support and the mascot open the same panel; Escape closes
 * it and focus returns to what opened it).
 */
let panel: { open: boolean; returnFocus: HTMLElement | null } = { open: false, returnFocus: null };
const panelListeners = new Set<() => void>();
const emitPanel = () => panelListeners.forEach((l) => l());

export const supportPanel = {
  open(returnFocus?: HTMLElement | null) {
    if (panel.open) return;
    panel = { open: true, returnFocus: returnFocus ?? (document.activeElement as HTMLElement | null) };
    emitPanel();
  },
  close() {
    if (!panel.open) return;
    panel = { ...panel, open: false };
    emitPanel();
  },
  get: () => panel,
  subscribe(listener: () => void) {
    panelListeners.add(listener);
    return () => void panelListeners.delete(listener);
  },
};

export function useSupportPanel() {
  return useSyncExternalStore(supportPanel.subscribe, supportPanel.get, supportPanel.get);
}

/** What the entry points badge: support's unread lines, while the panel is closed. */
export function useSupportUnread(): number {
  const { conversation } = useSupportThread();
  const { open } = useSupportPanel();
  return open ? 0 : Math.max(0, conversation?.unread ?? 0);
}
