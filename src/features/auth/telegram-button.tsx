import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTelegramSignIn, type TelegramUser } from "./session";

declare global {
  interface Window {
    onChoChoTelegramAuth?: (user: TelegramUser) => void;
  }
}

/**
 * Telegram's login widget, bound to the bot identity validates against. The widget renders its own button; ours
 * is the design's frame around it. With no bot configured (VITE_TELEGRAM_BOT empty) the button says so honestly
 * rather than pretending — the design's "Telegram sign-in is currently unavailable" state.
 */
export function TelegramButton({ onSignedIn, onError }: { onSignedIn: () => void; onError: (code: string) => void }) {
  const { t } = useTranslation();
  const bot = import.meta.env.VITE_TELEGRAM_BOT;
  const host = useRef<HTMLDivElement>(null);
  const signIn = useTelegramSignIn();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!bot || !host.current) return;
    window.onChoChoTelegramAuth = (user) => {
      signIn.mutate(user, { onSuccess: onSignedIn, onError: (e) => onError(e.errorCode) });
    };
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", bot);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "14");
    script.setAttribute("data-onauth", "onChoChoTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    host.current.replaceChildren(script);
    return () => {
      delete window.onChoChoTelegramAuth;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot]);

  if (!bot) {
    return (
      <button
        type="button"
        onClick={() => setNotice(t("auth.telegramUnavailable"))}
        className="flex h-[54px] w-full items-center justify-center gap-[11px] rounded-cc-lg border border-[rgba(94,167,235,.4)] bg-[linear-gradient(180deg,#2b1450_0%,#1d0b36_100%)] text-[14.5px] font-bold text-cc-ink hover:border-[rgba(94,167,235,.75)]"
        aria-describedby={notice ? "tg-notice" : undefined}
      >
        <TelegramIcon />
        {t("auth.telegram")}
        {notice ? <span id="tg-notice" className="sr-only">{notice}</span> : null}
      </button>
    );
  }

  return <div ref={host} className="flex min-h-[54px] items-center justify-center" aria-busy={signIn.isPending} />;
}

export function TelegramIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="#5eabeb">
      <path d="M21.6 3.4 2.9 10.6c-.9.3-.9 1.5 0 1.8l4.4 1.5 1.7 5.3c.2.7 1.1.9 1.6.3l2.4-2.6 4.5 3.3c.6.4 1.5.1 1.7-.7l3-14.4c.2-.9-.7-1.6-1.6-1.3z" />
    </svg>
  );
}
