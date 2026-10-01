import { queryOptions, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import { toApiError } from "@/api/problem";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/features/auth/session";
import { supportStore, type SendFailure } from "./support-store";

/** chat's own cap on a line (`ChatLimits`); the composer counts down near it. */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * P3-31 — the player's side of chat, through the gateway on the skin's origin (cookie → bearer). Reads write into
 * `supportStore`; the hub (`support-connection.tsx`) writes into the same store.
 */
let loadInFlight: { epoch: number; done: Promise<void> } | null = null;

/** Open / resync: the latest page of the thread and the conversation (null before the first line). */
export function loadConversation(): Promise<void> {
  if (!loadInFlight || loadInFlight.epoch !== supportStore.epoch()) {
    supportStore.loading();
    const epoch = supportStore.epoch();
    const done: Promise<void> = (async () => {
      try {
        const { data } = await api.GET("/api/v1/support/conversation", {});
        if (epoch !== supportStore.epoch()) return;
        if (data) supportStore.opened(data.conversation, data.messages, data.hasMore);
      } catch {
        if (epoch === supportStore.epoch()) supportStore.failed();
      }
    })().finally(() => {
      if (loadInFlight?.done === done) loadInFlight = null;
    });
    loadInFlight = { epoch, done };
  }
  return loadInFlight.done;
}

/** Scrolled to the top: the page before the oldest line loaded. */
export async function loadOlder(): Promise<void> {
  const s = supportStore.get();
  const first = s.messages[0];
  if (!first || !s.hasMore || s.loadingOlder) return;
  supportStore.olderLoading(true);
  const epoch = supportStore.epoch();
  try {
    const { data } = await api.GET("/api/v1/support/messages", { params: { query: { before: first.id } } });
    if (epoch !== supportStore.epoch()) return;
    if (data) supportStore.older(data.items, data.hasMore);
    else supportStore.olderLoading(false);
  } catch {
    supportStore.olderLoading(false);
  }
}

const failureOf = (error: unknown): SendFailure => {
  const e = toApiError(error);
  if (e.status === 429 || e.errorCode === "RATE_LIMITED") return "RATE_LIMITED";
  if (e.status === 404) return "GONE";
  if (e.status === 400) return "VALIDATION_FAILED";
  return "NETWORK";
};

/**
 * Send a line (free text, or a canned question — `body` is then the question, shown until the server's copy lands).
 * Optimistic: the line shows at once under its `clientMessageId`; chat answers the same lines for the same id, so a
 * Retry after a lost answer can never post twice.
 */
export async function sendLine(line: { clientMessageId?: string; body: string; cannedAnswerId?: string | null }): Promise<void> {
  const clientMessageId = line.clientMessageId ?? crypto.randomUUID();
  const cannedAnswerId = line.cannedAnswerId ?? null;
  supportStore.sending({ clientMessageId, body: line.body, cannedAnswerId });
  const epoch = supportStore.epoch();
  try {
    const { data } = await api.POST("/api/v1/support/messages", {
      body: { clientMessageId, text: cannedAnswerId ? null : line.body, cannedAnswerId },
    });
    if (epoch !== supportStore.epoch()) return;
    if (data) {
      supportStore.received(data.messages);
      supportStore.conversation(data.conversation);
      // A line the answer somehow did not carry must not spin forever.
      supportStore.discard(clientMessageId);
    }
  } catch (error) {
    if (epoch === supportStore.epoch()) supportStore.sendFailed(clientMessageId, failureOf(error));
  }
}

/** Retry a line that did not go — the same clientMessageId. */
export function retryLine(clientMessageId: string) {
  const line = supportStore.get().pending.find((p) => p.clientMessageId === clientMessageId);
  if (line) return sendLine(line);
  return Promise.resolve();
}

let readInFlight = false;

/** The panel is open and visible with unread lines: they are seen. */
export async function markRead(): Promise<void> {
  if (readInFlight) return;
  readInFlight = true;
  try {
    await api.POST("/api/v1/support/read", {});
    supportStore.markedRead();
  } catch {
    // the next open / the next line tries again
  } finally {
    readInFlight = false;
  }
}

/** chat keys canned answers by a bare language code (`en`); the UI's are regional (`en-PH`). */
export const cannedLanguage = (lng: string) => (lng || "en").split("-")[0]!.toLowerCase();

export const supportQueries = {
  canned: (language: string) => queryOptions({
    queryKey: queryKeys.session.supportCanned(language),
    queryFn: async () => (await api.GET("/api/v1/support/canned", { params: { query: { language } } })).data ?? [],
    staleTime: 5 * 60_000,
  }),
};

export function useCannedQuestions(enabled: boolean) {
  const { i18n } = useTranslation();
  const { signedIn } = useSession();
  return useQuery({ ...supportQueries.canned(cannedLanguage(i18n.language)), enabled: signedIn && enabled });
}
