import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MASKED, peso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useBalance, useBalanceHidden } from "./balance-store";
import { useBonusCounts } from "@/features/bonus/api";
import { bonusDrawer } from "@/features/bonus/bonus-drawer";

/**
 * Design (Header, signed in): the balance box — "Balance" + the live total (masked when the shared Hide balance
 * setting is on, "—" while unknown) linking to the Wallet — and a chevron opening "Balance details": Cash balance,
 * Bonus balance, the Available to claim / Active bonuses counts and "View my bonuses". Closes on an outside press and
 * on Escape. "View my bonuses" opens the bonuses drawer in place (P3-29), handing focus back to the chevron on close.
 * The panel hangs from the sticky header, not the box: under its right edge (22px in) on desktop, edge to edge
 * (10px in) on phones — the design's placement.
 */
export function BalanceMenu() {
  const { t } = useTranslation();
  const balance = useBalance();
  const [hidden] = useBalanceHidden();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const chevron = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const text = balance.status !== "live" ? "—" : hidden ? MASKED : peso(balance.balance.totalCents);

  return (
    <span ref={box} className="flex h-10 min-w-0 flex-initial items-center overflow-hidden rounded-cc border border-[rgba(167,139,250,.26)] bg-white/[.02]">
      <Link to="/wallet" className="flex h-full min-w-0 items-center gap-[9px] px-2 text-[13px] min-[400px]:px-3 min-[400px]:text-[13.5px] font-bold text-cc-text hover:bg-[rgba(167,139,250,.12)] md:px-[14px] md:text-[14px]">
        <span className="hidden text-[12px] font-semibold text-cc-lavender md:inline">{t("nav.balance")}</span>
        <span className="tabular truncate" title={text} data-testid="header-balance">{text}</span>
      </Link>
      <button ref={chevron} type="button" aria-label={t("balance.showDetails")} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        className="flex h-full w-8 flex-none items-center justify-center border-l border-[rgba(167,139,250,.2)] bg-white/[.03] text-[11px] text-[#cbb6e6] hover:bg-[rgba(167,139,250,.16)] hover:text-white md:w-[34px]">
        {open ? "▲" : "▼"}
      </button>
      {open ? <BalancePanel onClose={() => setOpen(false)} onBonuses={() => { setOpen(false); bonusDrawer.open(chevron.current); }} /> : null}
    </span>
  );
}

function BalancePanel({ onClose, onBonuses }: { onClose: () => void; onBonuses: () => void }) {
  const { t } = useTranslation();
  const balance = useBalance();
  const [hidden] = useBalanceHidden();
  const bonuses = useBonusCounts();
  const amount = (cents: number) => (hidden ? MASKED : peso(cents));

  return (
    <div role="dialog" aria-label={t("balance.details")}
      className="absolute top-[calc(100%+6px)] right-[10px] left-[10px] z-[120] flex max-h-[calc(100dvh-120px)] animate-cc-rise flex-col gap-3 overflow-y-auto rounded-cc-xl border border-cc-line-strong bg-[linear-gradient(170deg,#2a1049_0%,#1a0930_100%)] p-4 shadow-[0_24px_60px_rgba(4,1,9,.7)] md:right-[22px] md:left-auto md:max-h-[min(420px,calc(100dvh-120px))] md:w-[296px] md:rounded-cc-lg">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-extrabold tracking-[1.1px] text-cc-muted uppercase">{t("balance.details")}</span>
        <button type="button" aria-label={t("balance.closeDetails")} onClick={onClose} className="-mt-1 -mr-1 flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] border border-[rgba(167,139,250,.26)] bg-white/[.05] text-[12px] font-extrabold text-[#cbb6e6] hover:bg-white/[.12] hover:text-white">✕</button>
      </div>
      {balance.status === "live" ? (
        <div className="flex flex-col gap-2">
          <Row label={t("balance.cash")} value={amount(balance.balance.cashCents)} />
          <Row label={t("balance.bonus")} value={amount(balance.balance.bonusCents)} gold />
        </div>
      ) : balance.status === "failed" ? (
        <p role="alert" className="m-0 text-[13px] text-[#fecaca]">{t("balance.unavailable")}</p>
      ) : (
        <div aria-label={t("common.loading")} aria-busy="true" className="h-[76px] animate-pulse rounded-cc-md border border-[rgba(167,139,250,.14)] bg-white/[.03]" />
      )}
      {bonuses.isError ? (
        <p role="alert" className="m-0 rounded-cc-md border border-cc-danger-line bg-[rgba(248,113,113,.08)] px-[13px] py-[11px] text-[12.5px] leading-[1.5] font-semibold text-pretty text-cc-danger">{t("balance.bonusesFailed")}</p>
      ) : (
        <div className="flex gap-2">
          <Count label={t("balance.availableToClaim")} value={bonuses.isPending ? "—" : String(bonuses.availableToClaim)} />
          <Count label={t("balance.activeBonuses")} value={bonuses.isPending ? "—" : String(bonuses.activeBonuses)} />
        </div>
      )}
      <button type="button" onClick={onBonuses} className="flex min-h-[46px] items-center justify-center rounded-cc-md bg-[image:var(--cc-gold-cta)] text-[14px] font-extrabold text-[#2c1400] shadow-[0_8px_20px_rgba(235,156,13,.3)] hover:brightness-105">
        {t("balance.viewBonuses")}
      </button>
    </div>
  );
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-cc-md border px-[13px] py-[11px]", gold ? "border-[rgba(255,201,60,.32)] bg-[rgba(255,201,60,.08)]" : "border-[rgba(167,139,250,.18)] bg-white/[.03]")}>
      <span className={cn("text-[12px] font-bold tracking-[.3px]", gold ? "text-[#f3e6c7]" : "text-cc-lavender")}>{label}</span>
      <span className={cn("tabular text-[15px] font-extrabold whitespace-nowrap", gold ? "text-[#ffd98a]" : "text-cc-ink")}>{value}</span>
    </div>
  );
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[3px] rounded-[11px] border border-[rgba(167,139,250,.18)] bg-white/[.03] px-[11px] py-[9px]">
      <span className="tabular text-[17px] font-extrabold text-cc-ink">{value}</span>
      <span className="text-[11px] leading-[1.35] font-semibold text-cc-lavender">{label}</span>
    </div>
  );
}
