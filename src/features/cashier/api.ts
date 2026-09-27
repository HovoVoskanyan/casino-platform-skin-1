import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import type { ApiError } from "@/api/problem";
import { queryKeys } from "@/lib/queryKeys";
import { SKIN_CURRENCY } from "@/lib/money";
import { useSession } from "@/features/auth/session";

/**
 * P3-28 — the cashier over payments' player surface (P6-01, published by the gateway since P6-13). The money never
 * moves on these calls: a deposit is credited when the PSP calls payments back, a withdrawal is paid after an
 * operator approves it. The screen watches the history for that.
 *
 * Payments writes 64-bit amounts as `number | string` (its int64 handling); every amount is read through `n()`.
 */
export type Method = components["schemas"]["MethodResponse"];
export type Payment = components["schemas"]["PaymentResponse"];
export type Quote = components["schemas"]["WithdrawalQuoteResponse"];
export type Direction = "deposit" | "withdraw";
export type HistoryFilter = "all" | "deposit" | "withdrawal";

export const n = (v: number | string | null | undefined) => Number(v ?? 0);

/** A payment the PSP or the operator has not finished with — the history is polled while one is on screen. */
export const isOpen = (status: string) => ["created", "pending", "processing", "submitting"].includes(status);

/** The design's four chips: completed, pending (anything still moving), failed, cancelled (incl. an operator's decline). */
export type Chip = "completed" | "pending" | "failed" | "cancelled";
export const chipOf = (status: string): Chip =>
  status === "completed" ? "completed" : isOpen(status) ? "pending" : status === "failed" ? "failed" : "cancelled";

/**
 * The player fee the method DISCLOSES on an amount (payments' FeeSchedule): `fix` cents, or `percent` in hundredths of
 * a percent (250 = 2.50%), never more than the amount. It is a disclosure, not a deduction: payments nets no fee —
 * a deposit credits the full amount, a withdrawal pays out the full amount (P6-01 S3: netting is a product decision
 * not taken). So the screens never show "you pay X + fee" or "you receive X − fee".
 */
export const feeOf = (method: Method, amountCents: number) => {
  const fee = n(method.fee);
  if (fee <= 0 || amountCents <= 0) return 0;
  return Math.min(amountCents, method.feeType === "percent" ? Math.round((amountCents * fee) / 10_000) : fee);
};

/** The design's method art, by name (payments carries no logo for them). */
export const methodArt = (method: Pick<Method, "name" | "logoUrl">) =>
  method.logoUrl ?? ({ gcash: "/gcash.jpg", maya: "/maya.jpg" } as Record<string, string>)[method.name.toLowerCase()] ?? null;

export function useMethods(direction: Direction) {
  const { signedIn } = useSession();
  return useQuery(queryOptions({
    queryKey: queryKeys.session.paymentMethods(direction),
    queryFn: async () => {
      const { data } = direction === "deposit"
        ? await api.GET("/api/payments/methods/deposit", { params: { query: { currency: SKIN_CURRENCY } } })
        : await api.GET("/api/payments/methods/withdraw", { params: { query: { currency: SKIN_CURRENCY } } });
      // Only the skin's currency: a method in another currency is another market's (the laptop's skin has both).
      return (data ?? []).filter((m) => m.currency === SKIN_CURRENCY).sort((a, b) => n(a.sortOrder) - n(b.sortOrder));
    },
    enabled: signedIn,
    staleTime: 60_000,
  }));
}

/**
 * The player's payments, newest first. While any row is still open it is re-read every few seconds: there is no
 * per-payment read and no push for payments, and the design's "Pending → Completed" must happen without a reload.
 */
export function useHistory(filter: HistoryFilter) {
  const { signedIn } = useSession();
  return useQuery(queryOptions({
    queryKey: queryKeys.session.paymentHistory(filter),
    queryFn: async () =>
      (await api.GET("/api/payments/history", { params: { query: { type: filter === "all" ? undefined : filter, take: 50 } } })).data ?? [],
    enabled: signedIn,
    refetchInterval: (query) => pollEvery(query.state.data ?? []),
  }));
}

/**
 * How often to re-read the history (review S10): every 4 s while a payment the player is plausibly waiting on right now
 * is open (made in the last 15 minutes — a deposit at the PSP, a withdrawal just submitted); once a minute while an
 * older one is still open (a withdrawal waiting hours for an operator); not at all when nothing is.
 */
export function pollEvery(rows: Payment[], now = Date.now()): number | false {
  const open = rows.filter((p) => isOpen(p.status));
  if (open.length === 0) return false;
  return open.some((p) => now - new Date(String(p.createdAt)).getTime() < 15 * 60_000) ? 4_000 : 60_000;
}

const invalidatePayments = (qc: ReturnType<typeof useQueryClient>) =>
  void qc.invalidateQueries({ queryKey: [...queryKeys.session.all, "payments", "history"] });

export function useCreateDeposit() {
  const qc = useQueryClient();
  return useMutation<Payment, ApiError, { methodId: string; amountCents: number }>({
    mutationFn: async ({ methodId, amountCents }) =>
      (await api.POST("/api/payments/deposits", { body: { methodId, currency: SKIN_CURRENCY, amountCents } })).data!,
    onSettled: () => invalidatePayments(qc),
  });
}

/** The quote writes nothing; `forfeitNotice` is always there and must be shown (P6-01 U1). */
export function useWithdrawalQuote() {
  return useMutation<Quote, ApiError, { methodId: string; amountCents: number }>({
    mutationFn: async ({ methodId, amountCents }) =>
      (await api.POST("/api/payments/withdrawals/quote", { body: { methodId, currency: SKIN_CURRENCY, amountCents } })).data!,
  });
}

export function useSubmitWithdrawal() {
  const qc = useQueryClient();
  return useMutation<Payment, ApiError, { methodId: string; amountCents: number; receiver: string; acknowledgeBonusForfeit: boolean }>({
    mutationFn: async (body) =>
      (await api.POST("/api/payments/withdrawals", { body: { ...body, currency: SKIN_CURRENCY, acknowledgeBonusForfeit: body.acknowledgeBonusForfeit || null } })).data!,
    onSettled: () => invalidatePayments(qc),
  });
}
