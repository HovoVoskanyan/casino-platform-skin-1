import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { peso, toCents } from "@/lib/money";
import { useBalance } from "@/features/wallet/balance-store";
import { AmountField } from "./amount-field";
import { n, useMethods, useSubmitWithdrawal, useWithdrawalQuote, type Payment, type Quote } from "./api";
import { cashierError } from "./errors";
import { MethodPicker } from "./method-picker";
import { StatusChip } from "./status-chip";

type Step = { kind: "form" } | { kind: "review"; quote: Quote } | { kind: "done"; payment: Payment };

/**
 * The e-wallet account is its PH mobile number; the PSP gets the national form the wallets print (09XXXXXXXXX).
 * Typed however a Filipino writes it (review S7): 917 123 4567, 0917-123-4567, 639171234567, +63 917 123 4567 —
 * and what the browser's tel autofill puts in.
 */
export const toReceiver = (typed: string) => {
  const digits = typed.replace(/[\s\-().]/g, "").replace(/^\+?63/, "").replace(/^0/, "");
  return /^9\d{9}$/.test(digits) ? `0${digits}` : null;
};

/**
 * P3-28 — Withdraw, built from the payments contract in the design's dialog style (owner 2026-09-28). The method,
 * the amount (up to AVAILABLE TO WITHDRAW) and the e-wallet number, then payments' QUOTE before anything is asked
 * for: the fee, what arrives, and `forfeitNotice` — on EVERY withdrawal, in the server's words (P6-01 U1). A refusal
 * (turnover, cooling-off…) is the quote's own `refusalMessage`. When a bonus would be forfeited the player must tick
 * the forfeit box before Confirm (`acknowledgeBonusForfeit`). A submitted withdrawal is Pending until an operator
 * approves it.
 */
export function WithdrawDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const methods = useMethods("withdraw");
  const quote = useWithdrawalQuote();
  const submit = useSubmitWithdrawal();
  const balance = useBalance();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [receiver, setReceiver] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; receiver?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "form" });
  // A second tap while the first submit is still on the wire is dropped here, synchronously — the button's disabled
  // state lands a render later, and the player endpoint takes no idempotency key (review S9).
  const submitting = useRef(false);

  const list = methods.data ?? [];
  const method = list.find((m) => m.methodId === methodId) ?? list[0] ?? null;
  const cents = toCents(amount);
  const withdrawable = balance.status === "live" ? balance.balance.withdrawableCents : null;

  const review = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!method) return;
    const next: typeof errors = {};
    if (cents == null || cents <= 0) next.amount = t("cashier.amountRequired");
    else if (cents < n(method.minAmountCents) || cents > n(method.maxAmountCents)) next.amount = t("cashier.amountOutOfRange", { min: peso(method.minAmountCents), max: peso(method.maxAmountCents) });
    else if (withdrawable != null && cents > withdrawable) next.amount = t("cashier.moreThanAvailable", { available: peso(withdrawable) });
    if (!toReceiver(receiver)) next.receiver = t("cashier.receiverInvalid", { method: method.name });
    setErrors(next);
    if (next.amount || next.receiver) return;

    quote.mutate({ methodId: method.methodId, amountCents: cents! }, {
      onSuccess: (q) => { setAck(false); setStep({ kind: "review", quote: q }); },
      onError: (err) => setError(cashierError(t, err.errorCode)),
    });
  };

  const confirm = () => {
    if (step.kind !== "review" || !method || cents == null || submitting.current) return;
    submitting.current = true;
    setError(null);
    submit.mutate({ methodId: method.methodId, amountCents: cents, receiver: toReceiver(receiver)!, acknowledgeBonusForfeit: ack }, {
      onSuccess: (payment) => setStep({ kind: "done", payment }),
      onError: (err) => setError(err.errorCode === "CONFLICT" && step.quote.bonusForfeit ? t("cashier.forfeitRequired") : cashierError(t, err.errorCode)),
      onSettled: () => void (submitting.current = false),
    });
  };

  const title = step.kind === "review" ? t("cashier.reviewTitle") : step.kind === "done" ? t("cashier.withdrawRequested") : t("cashier.withdrawTitle");

  return (
    <Dialog open={open} onOpenChange={onOpenChange} eyebrow={t("cashier.withdraw")} title={title}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {step.kind === "done" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-cc-lg border border-cc-line bg-white/[.03] px-4 py-3">
            <span className="flex flex-col">
              <span className="text-[12px] text-cc-lavender">{t("cashier.withdrawalTo", { method: method?.name, receiver: step.payment.receiver ?? toReceiver(receiver) })}</span>
              <span className="tabular text-[22px] font-extrabold text-cc-ink">{peso(step.payment.amountCents)}</span>
            </span>
            <StatusChip chip="pending" />
          </div>
          <Notice tone="info">{t("cashier.withdrawPendingExplain")}</Notice>
          <Button variant="primary" size="lg" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </div>
      ) : step.kind === "review" ? (
        <div className="flex flex-col gap-4">
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-2 rounded-cc-lg border border-cc-line bg-white/[.03] px-4 py-3 text-[14px]">
            <dt className="text-cc-lavender">{t("cashier.paidOut")}</dt><dd className="m-0 text-right font-extrabold text-cc-ink tabular">{peso(step.quote.amountCents)}</dd>
            {/* the quote's fee is disclosed, never deducted: payments pays out the full amount (FeeSchedule) */}
            {n(step.quote.feeCents) > 0 ? (<><dt className="text-cc-lavender">{t("cashier.methodFee")}</dt><dd className="m-0 text-right font-bold text-cc-ink tabular">{peso(step.quote.feeCents)}</dd></>) : null}
            <dt className="text-cc-lavender">{t("cashier.to")}</dt><dd className="m-0 text-right font-bold text-cc-ink">{method?.name} · {toReceiver(receiver)}</dd>
          </dl>
          {/* The server's words, on every withdrawal (P6-01 U1) — never paraphrased here. */}
          <Notice tone="info" role="note">{step.quote.forfeitNotice}</Notice>
          {!step.quote.allowed ? (
            <>
              <Notice tone="error">{step.quote.refusalMessage ?? cashierError(t, step.quote.refusalCode ?? undefined)}</Notice>
              <Button variant="secondary" size="lg" onClick={() => setStep({ kind: "form" })}>{t("cashier.back")}</Button>
            </>
          ) : (
            <>
              {step.quote.bonusForfeit ? (
                <label className="flex items-start gap-3 rounded-cc-lg border border-[rgba(255,201,60,.35)] bg-[rgba(255,201,60,.07)] p-4 text-[13.5px] leading-[1.5] text-[#f3e6c7]">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-[3px] h-[18px] w-[18px] flex-none accent-[#ffc93c]" />
                  <span>{t("cashier.forfeitAck", { amount: peso(step.quote.bonusForfeit.totalCents) })}</span>
                </label>
              ) : null}
              <Button variant="primary" size="lg" loading={submit.isPending} disabled={!!step.quote.bonusForfeit && !ack} onClick={confirm}>{t("cashier.confirmWithdraw")}</Button>
              <Button variant="secondary" size="lg" onClick={() => setStep({ kind: "form" })}>{t("cashier.back")}</Button>
            </>
          )}
        </div>
      ) : methods.isPending ? (
        <div aria-label={t("common.loading")} className="h-[260px] animate-pulse rounded-cc-lg bg-white/[.04]" />
      ) : methods.isError ? (
        <Notice tone="error">{t("cashier.methodsFailed")}</Notice>
      ) : list.length === 0 ? (
        <Notice tone="info">{t("wallet.withdrawUnavailable")}</Notice>
      ) : (
        <form onSubmit={review} noValidate className="flex flex-col gap-4">
          <MethodPicker methods={list} value={method?.methodId ?? null} onChange={setMethodId} label={t("cashier.method")} />
          <AmountField id="withdraw-amount" label={t("cashier.amount")} value={amount} onChange={(v) => { setAmount(v); setErrors((x) => ({ ...x, amount: undefined })); }}
            error={errors.amount} minCents={method ? n(method.minAmountCents) : undefined} maxCents={method ? n(method.maxAmountCents) : undefined} />
          {withdrawable != null ? (
            <div className="-mt-2 flex items-center justify-between text-[13px]">
              <span className="text-cc-lavender">{t("cashier.available", { amount: peso(withdrawable) })}</span>
              <button type="button" className="font-bold text-cc-gold" onClick={() => setAmount((withdrawable / 100).toFixed(2))}>{t("cashier.max")}</button>
            </div>
          ) : null}
          <Field label={t("cashier.receiver", { method: method?.name })} htmlFor="withdraw-receiver" hint={t("cashier.receiverHint")} error={errors.receiver}>
            <div className="relative flex">
              <span aria-hidden className="absolute left-0 top-0 flex h-full items-center border-r border-cc-line-strong px-[14px] text-[15px] font-bold text-cc-text">+63</span>
              <Input id="withdraw-receiver" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="9XXXXXXXXX" maxLength={20} className="pl-[68px]"
                aria-invalid={!!errors.receiver} value={receiver} onChange={(e) => { setReceiver(e.target.value); setErrors((x) => ({ ...x, receiver: undefined })); }} />
            </div>
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={quote.isPending}>{t("cashier.review")}</Button>
        </form>
      )}
    </Dialog>
  );
}
