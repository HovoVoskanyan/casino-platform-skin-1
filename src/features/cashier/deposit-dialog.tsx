import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { peso, toCents } from "@/lib/money";
import { AmountField } from "./amount-field";
import { chipOf, feeOf, n, useCreateDeposit, useHistory, useMethods, type Payment } from "./api";
import { cashierError } from "./errors";
import { MethodPicker } from "./method-picker";
import { StatusChip } from "./status-chip";

const QUICK_PESOS = [500, 1_000, 2_500, 5_000];

/**
 * P3-28 — Deposit, built from the payments contract in the design's dialog style (owner 2026-09-28: the design has
 * no deposit form). Pick GCash or Maya, an amount inside the method's range; payments answers where to pay — a link
 * (opened in a new tab by the player's tap: the PSP's page must not replace the skin) or a QR — and the money arrives only when the PSP
 * calls payments back. The dialog then follows the deposit in the history until it completes or fails; the
 * balance header moves on its own (the hub).
 */
export function DepositDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const methods = useMethods("deposit");
  const create = useCreateDeposit();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Payment | null>(null);
  const submitting = useRef(false); // see WithdrawDialog: one deposit per tap, even before the button disables

  const list = methods.data ?? [];
  const method = list.find((m) => m.methodId === methodId) ?? list[0] ?? null;
  const cents = toCents(amount);
  const fee = method && cents ? feeOf(method, cents) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!method) return;
    if (cents == null || cents <= 0) return setFieldError(t("cashier.amountRequired"));
    if (cents < n(method.minAmountCents) || cents > n(method.maxAmountCents)) {
      return setFieldError(t("cashier.amountOutOfRange", { min: peso(method.minAmountCents), max: peso(method.maxAmountCents) }));
    }

    setFieldError(undefined);
    if (submitting.current) return;
    submitting.current = true;
    create.mutate({ methodId: method.methodId, amountCents: cents }, {
      // The PSP page opens from the player's own tap on the next step: a window opened after an await is a popup
      // the browser blocks.
      onSuccess: (payment) => setCreated(payment),
      onError: (err) => setError(cashierError(t, err.errorCode)),
      onSettled: () => void (submitting.current = false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} eyebrow={t("cashier.deposit")} title={created ? t("cashier.depositWith", { method: method?.name }) : t("cashier.depositTitle")}>
      {created ? (
        <DepositProgress payment={created} methodName={method?.name ?? ""} onClose={() => onOpenChange(false)} />
      ) : methods.isPending ? (
        <div aria-label={t("common.loading")} className="h-[220px] animate-pulse rounded-cc-lg bg-white/[.04]" />
      ) : methods.isError ? (
        <Notice tone="error">{t("cashier.methodsFailed")}</Notice>
      ) : list.length === 0 ? (
        <Notice tone="info">{t("wallet.depositUnavailable")}</Notice>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <MethodPicker methods={list} value={method?.methodId ?? null} onChange={setMethodId} label={t("cashier.method")} />
          <AmountField id="deposit-amount" label={t("cashier.amount")} value={amount} onChange={(v) => { setAmount(v); setFieldError(undefined); }}
            error={fieldError} minCents={method ? n(method.minAmountCents) : undefined} maxCents={method ? n(method.maxAmountCents) : undefined}
            quick={QUICK_PESOS.filter((p) => !method || (p * 100 >= n(method.minAmountCents) && p * 100 <= n(method.maxAmountCents)))} />
          {cents && fee > 0 ? <p className="m-0 text-[13px] text-cc-lavender">{t("cashier.feeDisclosed", { fee: peso(fee), method: method?.name })}</p> : null}
          <Button type="submit" variant="primary" size="lg" loading={create.isPending}>{t("cashier.continueTo", { method: method?.name })}</Button>
          <p className="m-0 text-center text-[12px] text-cc-muted">{t("cashier.depositFinePrint")}</p>
        </form>
      )}
    </Dialog>
  );
}

/** After create: where to pay, then the deposit's own row from the history until it settles. */
function DepositProgress({ payment, methodName, onClose }: { payment: Payment; methodName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const history = useHistory("deposit");
  const row = history.data?.find((p) => p.id === payment.id) ?? payment;
  const chip = chipOf(row.status);
  const qr = payment.paymentQr;
  // An image we can show (a data URL, or a link to a PNG/SVG); anything else is the QR's own payload, which the
  // player cannot scan as text — they are sent to the provider's page instead.
  const qrIsImage = !!qr && (/^data:image\//.test(qr) || /^https:\/\/\S+\.(png|svg|jpe?g|gif|webp)(\?\S*)?$/i.test(qr));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-cc-lg border border-cc-line bg-white/[.03] px-4 py-3">
        <span className="flex flex-col">
          <span className="text-[12px] text-cc-lavender">{t("cashier.depositOf", { method: methodName })}</span>
          <span className="tabular text-[22px] font-extrabold text-cc-ink">{peso(payment.amountCents)}</span>
        </span>
        <StatusChip chip={chip} />
      </div>

      {chip === "completed" ? (
        <Notice tone="ok">{t("cashier.depositCompleted", { amount: peso(row.amountCents) })}</Notice>
      ) : chip === "pending" ? (
        <>
          {payment.paymentUrl ? (
            <>
              <p className="m-0 text-[14px] leading-[1.55] text-cc-text">{t("cashier.payInTab", { method: methodName })}</p>
              <Button asChild variant="secondary" size="lg"><a href={payment.paymentUrl} target="_blank" rel="noopener noreferrer">{t("cashier.openPayment", { method: methodName })}</a></Button>
            </>
          ) : null}
          {qr ? (
            <div className="flex flex-col items-center gap-2">
              <p className="m-0 text-center text-[14px] text-cc-text">{t("cashier.scanQr", { method: methodName })}</p>
              {qrIsImage ? <img src={qr} alt={t("cashier.qrAlt", { method: methodName })} className="h-[220px] w-[220px] rounded-cc-lg bg-white p-2" /> : <Notice tone="info">{t("cashier.qrUnreadable", { method: methodName })}</Notice>}
            </div>
          ) : null}
          {payment.receiver ? <p className="m-0 text-[13px] text-cc-lavender">{t("cashier.payTo", { receiver: payment.receiver })}</p> : null}
          <Notice tone="info">{t("cashier.waitingForPayment", { method: methodName })}</Notice>
        </>
      ) : (
        <Notice tone="error">{t(chip === "failed" ? "cashier.depositFailed" : "cashier.depositCancelled")}</Notice>
      )}

      <Button variant={chip === "completed" ? "primary" : "secondary"} size="lg" onClick={onClose}>{t(chip === "pending" ? "cashier.closeKeepGoing" : "common.close")}</Button>
    </div>
  );
}
