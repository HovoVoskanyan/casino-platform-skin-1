import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { peso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { chipOf, useHistory, useMethods, type HistoryFilter, type Payment } from "./api";
import { StatusChip } from "./status-chip";

const FILTERS: HistoryFilter[] = ["all", "deposit", "withdrawal"];
const RECENT = 5;

/** The design's date: "10 Sep 2026 · 07:42 PM". */
const when = (iso: unknown) => {
  const d = new Date(String(iso));
  return `${d.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
};

/** A payment's reference as support reads it back: the payment id, which is what every operator screen searches by. */
export const referenceOf = (p: Pick<Payment, "id">) => p.id.toUpperCase();

/**
 * Design (Wallet → Recent transactions): All / Deposits / Withdrawals, the first five then "View all transactions",
 * rows of type + method, date, signed amount and status chip, "View details" opening the transaction dialog. Every
 * state the design draws: loading, error with Retry, empty, no match with Clear filter.
 */
export function Transactions() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Payment | null>(null);
  const history = useHistory(filter);
  const everything = useHistory("all");
  const deposits = useMethods("deposit");
  const withdrawals = useMethods("withdraw");
  const methodName = (id: string) => [...(deposits.data ?? []), ...(withdrawals.data ?? [])].find((m) => m.methodId === id)?.name ?? t("cashier.eWallet");

  const rows = history.data ?? [];
  const shown = showAll ? rows : rows.slice(0, RECENT);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="tx-title">
      <h2 id="tx-title" className="m-0 text-[24px] font-extrabold tracking-[-0.4px] text-cc-ink">{t("wallet.recent")}</h2>
      <div role="group" aria-label={t("wallet.filter")} className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setShowAll(false); }}
            className={cn("h-10 rounded-full border px-4 text-[13.5px] font-bold",
              filter === f ? "border-[rgba(255,201,60,.5)] bg-[image:var(--cc-gold-cta)] text-[#2c1400]" : "border-[rgba(167,139,250,.24)] bg-white/[.03] text-[#bfaed8]")}>
            {t(`wallet.filter.${f}`)}
          </button>
        ))}
      </div>

      {history.isPending ? (
        <div aria-label={t("wallet.loadingTransactions")} className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[68px] animate-pulse rounded-[16px] bg-white/[.04]" />)}
        </div>
      ) : history.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[rgba(248,113,113,.4)] p-4 text-[13.5px] text-[#fecaca]">
          <span className="flex-1">{t("wallet.transactionsFailed")}</span>
          <Button size="sm" variant="primary" onClick={() => void history.refetch()}>{t("common.retry")}</Button>
        </div>
      ) : rows.length === 0 ? (
        (everything.data?.length ?? 0) > 0 && filter !== "all" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-dashed border-cc-line-strong p-5 text-[14px] text-cc-lavender">
            <span className="flex-1">{t("wallet.noMatch")}</span>
            <Button size="sm" variant="secondary" onClick={() => setFilter("all")}>{t("wallet.clearFilter")}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 rounded-[16px] border border-dashed border-cc-line-strong p-6 text-center">
            <strong className="text-[15px] text-cc-ink">{t("wallet.noTransactions")}</strong>
            <span className="text-[13.5px] text-cc-lavender">{t("wallet.noTransactionsBody")}</span>
          </div>
        )
      ) : (
        <>
          <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
            {shown.map((p) => <Row key={p.id} payment={p} method={methodName(p.methodId)} onOpen={() => setOpen(p)} />)}
          </ul>
          {rows.length > RECENT ? (
            <Button variant="secondary" onClick={() => setShowAll((s) => !s)}>{t(showAll ? "wallet.showRecent" : "wallet.viewAll")}</Button>
          ) : null}
        </>
      )}

      <TransactionDialog payment={open ? rows.find((p) => p.id === open.id) ?? open : null} method={open ? methodName(open.methodId) : ""} onClose={() => setOpen(null)} />
    </section>
  );
}

function Row({ payment, method, onOpen }: { payment: Payment; method: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const deposit = payment.type === "deposit";
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-[rgba(167,139,250,.16)] bg-white/[.03] px-4 py-[14px] md:grid-cols-[36px_minmax(0,2.1fr)_minmax(150px,1.4fr)_minmax(104px,1fr)_minmax(118px,1fr)_116px]">
      <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center rounded-[11px] border text-[16px] font-extrabold",
        deposit ? "border-[rgba(74,222,128,.28)] bg-[rgba(74,222,128,.1)] text-[#86efac]" : "border-[rgba(167,139,250,.26)] bg-[rgba(167,139,250,.12)] text-[#c4b5fd]")}>{deposit ? "↓" : "↑"}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[14.5px] font-bold text-cc-ink">{t(deposit ? "wallet.typeDeposit" : "wallet.typeWithdrawal")}</span>
        <span className="truncate text-[12px] text-cc-muted"><span className="sr-only">{t("wallet.srMethod")}</span>{method}<span className="md:hidden"> · {when(payment.createdAt)}</span></span>
      </span>
      <span className="hidden text-[13px] text-cc-lavender md:inline"><span className="sr-only">{t("wallet.srDate")}</span>{when(payment.createdAt)}</span>
      <span className={cn("text-right text-[14.5px] font-extrabold tabular md:text-left", deposit ? "text-[#86efac]" : "text-cc-label")}>
        <span className="sr-only">{t("wallet.srAmount")}</span>{deposit ? "+" : "−"}{peso(payment.amountCents)}
      </span>
      <span className="col-span-2 col-start-2 flex items-center justify-between gap-2 md:col-span-1 md:col-start-auto">
        <StatusChip chip={chipOf(payment.status)} />
        <Button size="sm" variant="secondary" className="min-h-[44px] md:hidden" onClick={onOpen}>{t("wallet.viewDetails")}</Button>
      </span>
      <Button size="sm" variant="secondary" className="hidden min-h-[44px] md:inline-flex" onClick={onOpen}>{t("wallet.viewDetails")}</Button>
    </li>
  );
}

function TransactionDialog({ payment, method, onClose }: { payment: Payment | null; method: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  if (!payment) return null;
  const deposit = payment.type === "deposit";
  const chip = chipOf(payment.status);
  const explain = chip === "pending" ? (deposit ? "wallet.explainDepositPending" : "wallet.explainPending")
    : chip === "failed" ? (deposit ? "wallet.explainDepositFailed" : "wallet.explainFailed")
    : payment.status === "rejected" ? "wallet.explainRejected" : null;
  const reference = referenceOf(payment);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} eyebrow={t("wallet.transaction")} title={t(deposit ? "wallet.typeDeposit" : "wallet.typeWithdrawal")} closeLabel={t("wallet.closeTransaction")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cn("tabular text-[32px] font-extrabold", deposit ? "text-[#86efac]" : "text-cc-ink")}>{deposit ? "+" : "−"}{peso(payment.amountCents)}</span>
        <StatusChip chip={chip} className="h-7" />
      </div>
      <dl className="m-0 flex flex-col gap-3">
        <Detail label={t("wallet.dateTime")} value={when(payment.createdAt)} />
        <Detail label={t("wallet.paymentMethod")} value={payment.receiver ? `${method} · ${payment.receiver}` : method} />
        <div className="flex flex-col gap-1">
          <dt className="text-[10.5px] font-extrabold tracking-[1.1px] text-cc-muted uppercase">{t("wallet.reference")}</dt>
          <dd className="m-0 flex items-center justify-between gap-2">
            <code className="break-all text-[13px] font-bold text-cc-label">{reference}</code>
            <button type="button" className="flex-none rounded-cc border border-cc-line-strong px-3 py-1 text-[12px] font-bold text-cc-control"
              onClick={() => { void navigator.clipboard?.writeText(reference); setCopied(true); setTimeout(() => setCopied(false), 1_800); }}>
              {t(copied ? "wallet.copied" : "wallet.copy")}
            </button>
          </dd>
        </div>
      </dl>
      {explain ? <p className="m-0 text-[13.5px] leading-[1.55] text-cc-text">{t(explain)}</p> : null}
      <p className="m-0 text-[13px] text-cc-lavender">{t("shell.needHelp")} <a href="/#support" className="font-bold text-cc-gold">{t("shell.support")}</a></p>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10.5px] font-extrabold tracking-[1.1px] text-cc-muted uppercase">{label}</dt>
      <dd className="m-0 text-[14px] font-bold text-cc-label">{value}</dd>
    </div>
  );
}
