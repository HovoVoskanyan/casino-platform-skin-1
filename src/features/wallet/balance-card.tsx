import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MASKED, peso } from "@/lib/money";
import { useBalance, useBalanceHidden } from "./balance-store";

/**
 * Design (Wallet): WALLET BALANCE with the Hide/Show pill (the shared setting), the total, AVAILABLE TO WITHDRAW and
 * BONUS FUNDS, Deposit (gold) and Withdraw. Loading = the pulsing card; a hub that cannot connect = the design's
 * wallet error with Retry. The buttons belong to the page (the cashier opens from them).
 */
export function BalanceCard({ onDeposit, onWithdraw, onRetry }: { onDeposit: () => void; onWithdraw: () => void; onRetry: () => void }) {
  const { t } = useTranslation();
  const balance = useBalance();
  const [hidden, setHidden] = useBalanceHidden();

  if (balance.status === "unknown") {
    return <div aria-label={t("wallet.loadingBalance")} className="h-[196px] animate-pulse rounded-[20px] border border-[rgba(255,201,60,.2)] bg-cc-surface-raised" />;
  }

  if (balance.status === "failed") {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-[20px] border border-[rgba(248,113,113,.4)] bg-[rgba(248,113,113,.06)] p-6">
        <strong className="text-[16px] text-cc-ink">{t("wallet.loadFailed")}</strong>
        <span className="text-[13.5px] text-cc-lavender">{t("wallet.loadFailedDetail")}</span>
        <div><Button variant="primary" onClick={onRetry}>{t("common.retry")}</Button></div>
      </div>
    );
  }

  const b = balance.balance;
  const show = (cents: number) => (hidden ? MASKED : peso(cents));
  return (
    <section aria-label={t("wallet.balanceLabel")} className="flex flex-col gap-5 rounded-[20px] border border-[rgba(255,201,60,.2)] bg-[linear-gradient(180deg,#23103f_0%,#180a2c_100%)] p-6 shadow-[0_16px_40px_rgba(0,0,0,.45)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11.5px] font-extrabold tracking-[1.3px] text-cc-lavender uppercase">{t("wallet.balanceLabel")}</span>
        <button type="button" aria-pressed={hidden} onClick={() => setHidden(!hidden)}
          className="h-7 rounded-full border border-cc-line-strong bg-white/[.04] px-3 text-[12px] font-bold text-cc-control">
          {t(hidden ? "wallet.showBalance" : "wallet.hideBalance")}
        </button>
      </div>
      <span aria-live="polite" className="tabular text-[38px] leading-none font-extrabold tracking-[-1px] text-cc-ink" data-testid="wallet-total">{show(b.totalCents)}</span>
      {!hidden ? (
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Figure label={t("wallet.availableToWithdraw")} value={peso(b.withdrawableCents)} />
          <Figure label={t("wallet.bonusFunds")} value={peso(b.bonusCents)} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" className="h-[52px] min-w-[132px] rounded-cc-lg text-[15px]" onClick={onDeposit}>{t("wallet.deposit")}</Button>
        <Button variant="secondary" className="h-[52px] min-w-[132px] rounded-cc-lg border-[rgba(167,139,250,.42)] text-[15px]" onClick={onWithdraw}>{t("wallet.withdraw")}</Button>
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-extrabold tracking-[1.1px] text-cc-muted uppercase">{label}</span>
      <span className="tabular text-[15px] font-bold text-cc-label">{value}</span>
    </div>
  );
}
