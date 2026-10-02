import type { i18n as I18n, TFunction } from "i18next";
import { SKIN_CURRENCY, peso } from "@/lib/money";
import { when } from "@/features/bonus/copy";
import type { PlayerNotice } from "./api";

/**
 * P3-30 — what a notice says and where it goes. Staff notices carry their own words (plain text, never HTML) and an
 * optional link; system notices carry a template + params and are written by the skin's catalogue
 * (`notices.<template>.title|body`). A template this skin does not know reads as a generic line, never a crash.
 */
export interface NoticeCopy {
  title: string;
  body: string | null;
}

/** Money in the skin's currency as everywhere else (₱1,250.00); another currency as "12.50 USD". */
export function noticeMoney(cents: number, currency: string | null | undefined): string {
  if (!currency || currency.toUpperCase() === SKIN_CURRENCY) return peso(cents);
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function noticeCopy(notice: PlayerNotice, t: TFunction, i18n: I18n): NoticeCopy {
  if (notice.kind === "staff") {
    return { title: notice.title?.trim() || t("notices.fallback.title"), body: notice.body?.trim() || null };
  }
  const key = `notices.${notice.template ?? ""}`;
  if (!notice.template || !i18n.exists(`${key}.title`)) return { title: t("notices.fallback.title"), body: t("notices.fallback.body") };
  const p = notice.params;
  const amount = p?.amountCents != null ? noticeMoney(p.amountCents, p.currency) : null;
  const expiresAt = when(p?.expiresAt);
  // A notice without its amount / deadline reads its `_plain` line (where the catalogue has one) — no empty blanks.
  const values = { amount, expiresAt, count: p?.count ?? 0, context: amount == null && expiresAt == null ? "plain" : undefined };
  return { title: t(`${key}.title`, values), body: i18n.exists(`${key}.body`, values) ? t(`${key}.body`, values) : null };
}

/** Where a system notice takes the player: the wallet for money, My Account → Bonuses for a bonus. */
const SYSTEM_LINKS: Record<string, string> = {
  deposit: "/wallet",
  withdrawal: "/wallet",
  bonus: "/account?tab=bonuses",
  freespins: "/account?tab=bonuses",
};

export type NoticeLink = { kind: "internal"; href: string } | { kind: "external"; href: string };

/**
 * A staff link is a site path (`/promotions`, navigated in the app) or an https URL (a new tab, no opener, no
 * referrer). Anything else — `//host`, `javascript:`, http — is not followed.
 */
export function noticeLink(notice: PlayerNotice): NoticeLink | null {
  if (notice.kind === "system") {
    const href = SYSTEM_LINKS[(notice.template ?? "").split(".")[0]!];
    return href ? { kind: "internal", href } : null;
  }
  const link = notice.link?.trim();
  if (!link) return null;
  // Review D1: a browser drops tabs and newlines inside a URL, so "/<tab>/evil.example" passes a prefix check and
  // resolves to //evil.example. Nothing with whitespace, a control character or a backslash is followed, and a path
  // must still land on this origin once resolved.
  for (const ch of link) {
    const code = ch.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || ch === "\\" || /\s/.test(ch)) return null;
  }
  if (link.startsWith("/") && !link.startsWith("//")) {
    const resolved = new URL(link, window.location.origin);
    return resolved.origin === window.location.origin
      ? { kind: "internal", href: resolved.pathname + resolved.search + resolved.hash }
      : null;
  }
  try {
    const url = new URL(link);
    if (url.protocol === "https:") return { kind: "external", href: url.href };
  } catch {
    // not a URL
  }
  return null;
}

/** "Just now", "5 minutes ago", "3 hours ago", "yesterday" — then the date, as the bonuses write it. */
export function noticeTime(iso: string, t: TFunction, language: string, now = Date.now()): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return t("notifications.justNow");
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  return (when(iso) ?? "").split(",")[0]!;
}
