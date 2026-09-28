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
    <span ref={box} className="relative flex h-10 flex-none items-center rounded-cc border border-[rgba(167,139,250,.26)] bg-white/[.02]">
      <Link to="/wallet" className="flex h-full items-center gap-[9px] rounded-l-cc px-3 text-[13.5px] font-bold text-cc-text hover:bg-[rgba(167,139,250,.12)] md:px-[14px] md:text-[14px]">
        <span className="hidden text-[12px] font-semibold text-cc-lavender md:inline">{t("nav.balance")}</span>
        <span className="tabular" data-testid="header-balance">{text}</span>
      </Link>
      <button ref={chevron} type="button" aria-label={t("balance.showDetails")} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        className="flex h-full w-8 items-center justify-center rounded-r-cc border-l border-[rgba(167,139,250,.2)] text-[10px] text-cc-control hover:bg-[rgba(167,139,250,.12)] md:w-[34px]">
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
      className="fixed left-[10px] right-[10px] top-[72px] z-50 flex max-h-[min(420px,calc(100vh-120px))] flex-col gap-3 overflow-auto rounded-cc-xl border border-cc-line-strong bg-[linear-gradient(170deg,#2a1049_0%,#1a0930_100%)] p-4 shadow-[0_24px_60px_rgba(4,1,9,.7)] md:absolute md:left-auto md:right-0 md:top-[calc(100%+6px)] md:w-[296px] md:rounded-cc-lg">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[1.1px] text-cc-muted uppercase">{t("balance.details")}</span>
        <button type="button" aria-label={t("balance.closeDetails")} onClick={onClose} className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border border-cc-line-strong bg-white/[.06] text-[#cbb6e6]">✕</button>
      </div>
      {balance.status === "live" ? (
        <>
          <Row label={t("balance.cash")} value={amount(balance.balance.cashCents)} />
          <Row label={t("balance.bonus")} value={amount(balance.balance.bonusCents)} gold />
        </>
      ) : balance.status === "failed" ? (
        <p role="alert" className="m-0 text-[13px] text-[#fecaca]">{t("balance.unavailable")}</p>
      ) : (
        <div aria-label={t("common.loading")} className="h-[76px] animate-pulse rounded-cc-md bg-white/[.05]" />
      )}
      {bonuses.isError ? (
        <p role="alert" className="m-0 text-[13px] text-[#fecaca]">{t("balance.bonusesFailed")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Count label={t("balance.availableToClaim")} value={bonuses.isPending ? "—" : String(bonuses.availableToClaim)} />
          <Count label={t("balance.activeBonuses")} value={bonuses.isPending ? "—" : String(bonuses.activeBonuses)} />
        </div>
      )}
      <button type="button" onClick={onBonuses} className="flex min-h-[46px] items-center justify-center rounded-cc-lg bg-[image:var(--cc-gold-cta)] text-[14.5px] font-extrabold text-[#2c1400]">
        {t("balance.viewBonuses")}
      </button>
    </div>
  );
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between rounded-cc-md border px-3 py-[11px]", gold ? "border-[rgba(255,201,60,.32)] bg-[rgba(255,201,60,.08)]" : "border-[rgba(167,139,250,.18)] bg-white/[.03]")}>
      <span className={cn("text-[13px] font-semibold", gold ? "text-[#f3e6c7]" : "text-cc-lavender")}>{label}</span>
      <span className={cn("tabular text-[15px] font-bold", gold ? "text-[#ffd98a]" : "text-cc-ink")}>{value}</span>
    </div>
  );
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-cc-md border border-[rgba(167,139,250,.18)] bg-white/[.03] px-3 py-[10px]">
      <span className="text-[11.5px] font-semibold text-cc-lavender">{label}</span>
      <span className="tabular text-[17px] font-extrabold text-cc-ink">{value}</span>
    </div>
  );
}
