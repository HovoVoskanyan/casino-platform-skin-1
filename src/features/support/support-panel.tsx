import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Spinner } from "@/components/ui/button";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { useSession } from "@/features/auth/session";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { loadConversation, loadOlder, markRead, MAX_MESSAGE_LENGTH, retryLine, sendLine, useCannedQuestions } from "./api";
import { supportPanel, supportStore, useSupportPanel, useSupportThread, type PendingLine, type PlayerMessage } from "./support-store";

/** The composer shows the countdown from here on. */
const COUNTER_FROM = MAX_MESSAGE_LENGTH - 200;

/**
 * P3-31 — design (Support): "Chat with ChoCho · Live support", the message list, the tappable questions and the
 * composer; one panel for Help, footer Support and the home support tile (and `#support` on any page). A floating
 * 380px panel at the bottom right from 600px up, a full-screen sheet below. A modal Radix dialog: focus moves in and
 * is trapped, Escape and ✕ close it, focus returns to what opened it. Signed-in players only (owner 2026-09-30): a
 * guest is offered sign-in and the FAQ.
 */
export function SupportPanel() {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const { open, returnFocus } = useSupportPanel();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const shownOn = useRef(path);

  // `#support` on any page opens the panel (the links that predate it, and a shared URL); the hash is then dropped.
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash.toLowerCase() !== "#support") return;
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
      supportPanel.open(null);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  // Leaving the page (the FAQ link) closes it, like the bonuses drawer.
  useEffect(() => {
    if (shownOn.current !== path) supportPanel.close();
    shownOn.current = path;
  }, [path]);
  useEffect(() => () => supportPanel.close(), []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? supportPanel.open() : supportPanel.close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[320] bg-cc-scrim data-[state=open]:animate-cc-fade min-[600px]:bg-[rgba(6,2,12,.35)]" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(e) => {
            if (returnFocus?.isConnected) {
              e.preventDefault();
              returnFocus.focus();
            }
          }}
          className={cn(
            "fixed inset-0 z-[320] flex flex-col gap-[14px] overflow-hidden bg-[linear-gradient(160deg,#2c1050_0%,#170826_100%)] p-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] outline-none data-[state=open]:animate-cc-rise",
            "min-[600px]:inset-auto min-[600px]:right-[26px] min-[600px]:bottom-[116px] min-[600px]:h-[min(600px,calc(100dvh-140px))] min-[600px]:w-[380px] min-[600px]:rounded-[20px] min-[600px]:border min-[600px]:border-[rgba(255,201,60,.32)] min-[600px]:p-5 min-[600px]:shadow-[0_24px_60px_rgba(0,0,0,.65)]",
          )}
        >
          <DialogPrimitive.Close aria-label={t("support.close")} className="absolute top-2 right-2 z-[2] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[14px] font-extrabold text-[#cbb6e6] hover:bg-white/20 min-[600px]:top-3 min-[600px]:right-3 min-[600px]:h-[30px] min-[600px]:w-[30px]">✕</DialogPrimitive.Close>
          <div className="flex flex-none items-center gap-[14px] pr-10">
            <div className="relative h-[62px] w-[62px] flex-none">
              <span aria-hidden className="absolute -inset-[6px] animate-cc-ring rounded-full border-2 border-[rgba(255,201,60,.5)]" />
              <div className="h-[62px] w-[62px] overflow-hidden rounded-full border-2 border-cc-gold">
                <img src="/support-agent.jpg" alt="" className="block h-full w-full origin-[52%_20%] scale-[1.35] object-cover object-[52%_20%]" />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <DialogPrimitive.Title className="m-0 text-[18px] font-extrabold text-cc-ink">{t("support.title")}</DialogPrimitive.Title>
              <span className="text-[12.5px] font-semibold text-[#4ade80]">● {t("support.live")}</span>
            </div>
          </div>
          <DialogPrimitive.Description className="sr-only">{t("support.description")}</DialogPrimitive.Description>
          {open ? (signedIn ? <Thread /> : <SignedOut />) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SignedOut() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.href });
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-cc-lg border border-white/[.07] bg-black/30 px-5 py-8 text-center">
      <p className="m-0 text-[17px] font-extrabold text-cc-ink">{t("support.signedOut.title")}</p>
      <p className="m-0 text-[13.5px] leading-[1.5] text-cc-lavender">{t("support.signedOut.body")}</p>
      <Button variant="primary" onClick={() => { supportPanel.close(); authDialog.open("signin", path); }}>{t("nav.signIn")}</Button>
      <Link to="/info/$page" params={{ page: "faq" }} className="flex min-h-11 items-center text-[13.5px] font-bold text-cc-gold">{t("support.faq")}</Link>
    </div>
  );
}

function Thread() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const thread = useSupportThread();
  const canned = useCannedQuestions(true);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prev = useRef<{ first?: string; height: number }>({ height: 0 });
  const unread = thread.conversation?.unread ?? 0;

  // Opening re-reads the thread (the hub keeps it live from there).
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    void loadConversation().then(() => setSynced(true));
  }, []);

  // Open, visible and something unread: it has been seen. Only once the opening read is in — marking read while it
  // is in flight would let its (older) unread count bring the dot back.
  useEffect(() => {
    if (!synced || unread <= 0) return;
    const seen = () => {
      if (document.visibilityState !== "hidden") void markRead();
    };
    seen();
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, [synced, unread]);

  // New lines keep the view at the bottom (when the reader was there); an older page keeps the reader's place.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const first = thread.messages[0]?.id;
    const grewAbove = prev.current.first && first !== prev.current.first && thread.messages.some((m) => m.id === prev.current.first);
    if (grewAbove) el.scrollTop += el.scrollHeight - prev.current.height;
    else if (stick.current) el.scrollTop = el.scrollHeight;
    prev.current = { first, height: el.scrollHeight };
  }, [thread.messages, thread.pending, thread.status]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 40 && thread.hasMore && !thread.loadingOlder) void loadOlder();
  };

  const send = (line: { body: string; cannedAnswerId?: string }) => {
    stick.current = true;
    void sendLine(line).then(() => {
      const gone = supportStore.get().pending.some((p) => p.failure === "GONE");
      // A question removed since the list was read: re-read the list.
      if (gone) void qc.invalidateQueries({ queryKey: queryKeys.session.supportCannedAll() });
    });
  };

  const empty = thread.status === "ready" && thread.messages.length === 0 && thread.pending.length === 0;
  const questions = canned.data ?? [];

  return (
    <>
      <div
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-label={t("support.messages")}
        aria-busy={thread.status === "loading" || thread.loadingOlder}
        className="flex min-h-24 flex-1 flex-col gap-[10px] overflow-y-auto rounded-cc-lg border border-white/[.07] bg-black/30 p-[14px] min-[600px]:min-h-[120px]"
      >
        {thread.hasMore ? (
          <button type="button" onClick={() => void loadOlder()} disabled={thread.loadingOlder} className="mx-auto flex min-h-9 items-center gap-2 rounded-full px-3 text-[12.5px] font-bold text-cc-lavender hover:text-cc-ink">
            {thread.loadingOlder ? <Spinner className="h-3 w-3" /> : null}
            {t("support.earlier")}
          </button>
        ) : null}
        {thread.status === "loading" && thread.messages.length === 0 ? (
          <p className="m-auto text-[13px] text-cc-lavender">{t("support.loading")}</p>
        ) : null}
        {thread.status === "failed" && thread.messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-2 text-center">
            <p role="alert" className="m-0 text-[13px] text-cc-lavender">{t("support.loadFailed")}</p>
            <Button size="sm" onClick={() => void loadConversation()}>{t("common.retry")}</Button>
          </div>
        ) : null}
        {empty ? <Bubble side="left" label={t("support.bot")} tone="system" body={t("support.greeting")} /> : null}
        {thread.messages.map((m) => <Line key={m.id} message={m} />)}
        {thread.pending.map((p) => <Pending key={p.clientMessageId} line={p} />)}
        {thread.conversation?.status === "closed" && thread.messages.length > 0 ? (
          <p className="m-0 text-center text-[12px] font-semibold text-cc-muted">{t("support.closed")}</p>
        ) : null}
      </div>

      {questions.length > 0 ? (
        <div role="group" aria-label={t("support.quickQuestions")} className="flex max-h-[96px] flex-none flex-wrap gap-2 overflow-y-auto">
          {questions.map((q) => (
            <button key={q.id} type="button" onClick={() => send({ body: q.question, cannedAnswerId: q.id })} className="h-10 rounded-full border border-[rgba(255,201,60,.32)] bg-[rgba(255,201,60,.07)] px-[14px] text-[12.5px] font-semibold text-cc-gold-hover hover:bg-[rgba(255,201,60,.18)] min-[600px]:h-[34px]">
              {q.question}
            </button>
          ))}
        </div>
      ) : null}

      <Composer onSend={(body) => send({ body })} />
    </>
  );
}

function Composer({ onSend }: { onSend: (body: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const ready = draft.trim().length > 0 && draft.length <= MAX_MESSAGE_LENGTH;
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!ready) return;
    onSend(draft.trim());
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a new line (and an IME composing a word is left alone).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-none flex-col gap-1">
      <div className="flex gap-[10px]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label={t("support.message")}
          aria-describedby={draft.length >= COUNTER_FROM ? "support-counter" : undefined}
          placeholder={t("support.placeholder")}
          className="max-h-[120px] min-h-[46px] min-w-0 flex-1 resize-none rounded-cc-md border border-white/[.13] bg-black/40 px-4 py-[12px] text-[16px] font-medium leading-[1.4] text-cc-ink outline-none [field-sizing:content] placeholder:text-[#7c689b] focus:border-[rgba(255,201,60,.6)] min-[600px]:text-[14px]"
        />
        <button type="submit" disabled={!ready} className="h-[46px] flex-none self-end rounded-cc-md bg-[image:var(--cc-gold-cta)] px-4 text-[14px] font-extrabold text-[#2c1400] hover:brightness-105 disabled:opacity-60 min-[600px]:px-[22px]">
          {t("support.send")}
        </button>
      </div>
      {draft.length >= COUNTER_FROM ? (
        <span id="support-counter" className={cn("self-end text-[11.5px] font-semibold tabular", draft.length >= MAX_MESSAGE_LENGTH ? "text-cc-danger" : "text-cc-muted")}>
          {t("support.counter", { count: draft.length, max: MAX_MESSAGE_LENGTH })}
        </span>
      ) : null}
    </form>
  );
}

function Line({ message }: { message: PlayerMessage }) {
  const { t } = useTranslation();
  if (message.author === "player") return <Bubble side="right" body={message.body} />;
  if (message.author === "agent") return <Bubble side="left" label={message.authorName ?? t("support.agent")} body={message.body} />;
  return <Bubble side="left" tone="system" label={t("support.bot")} body={message.body} />;
}

function Pending({ line }: { line: PendingLine }) {
  const { t } = useTranslation();
  if (line.status === "sending") return <Bubble side="right" body={line.body} note={t("support.sending")} faded />;
  const gone = line.failure === "GONE";
  return (
    <div className="flex flex-col items-end gap-1">
      <Bubble side="right" body={line.body} faded />
      <div role="alert" className="flex max-w-[85%] flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right text-[12px] font-semibold text-cc-danger">
        <span>{t(`support.failed.${line.failure ?? "NETWORK"}`)}</span>
        {gone ? (
          <button type="button" onClick={() => supportStore.discard(line.clientMessageId)} className="min-h-8 font-bold text-cc-gold underline underline-offset-2">{t("support.dismiss")}</button>
        ) : (
          <button type="button" onClick={() => void retryLine(line.clientMessageId)} className="min-h-8 font-bold text-cc-gold underline underline-offset-2">{t("common.retry")}</button>
        )}
      </div>
    </div>
  );
}

/** Plain text only: the body is a React text node (never HTML); `pre-wrap` keeps the player's line breaks. */
function Bubble({ side, body, label, tone, note, faded }: { side: "left" | "right"; body: string; label?: string; tone?: "system"; note?: string; faded?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1", side === "right" ? "items-end" : "items-start")}>
      {label ? <span className="px-1 text-[11px] font-bold tracking-[.2px] text-cc-muted">{label}</span> : null}
      <span
        className={cn(
          "max-w-[78%] rounded-cc-lg px-[14px] py-[11px] text-[13.5px] font-medium leading-[1.5] break-words whitespace-pre-wrap",
          side === "right" ? "bg-[image:var(--cc-gold-cta)] text-[#2c1400]" : tone === "system" ? "border border-cc-info-line bg-cc-info-soft text-cc-info-text" : "bg-white/[.07] text-cc-text",
          faded && "opacity-70",
        )}
      >
        {body}
      </span>
      {note ? <span className="px-1 text-[11px] font-semibold text-cc-muted">{note}</span> : null}
    </div>
  );
}
