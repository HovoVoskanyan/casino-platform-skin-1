/**
 * Money as the ChoCho design writes it. The skin holds ONE currency (P3-16: PHP only, a fork per skin), so there is no
 * currency picker anywhere — a launch, a deposit and a withdrawal all name this one.
 */
export const SKIN_CURRENCY = "PHP";

/** The design's `peso(n)`: ₱12,480.50 — the sign glued to the number, two decimals, en-PH grouping. */
export const peso = (cents: number | string) =>
  "₱" + (Number(cents) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What a hidden balance reads as (six U+2022), wherever the shared Hide balance setting applies. */
export const MASKED = "••••••";

/** Whole pesos typed by a player → cents; null when it is not an amount (the form says so). */
export function toCents(text: string): number | null {
  const cleaned = text.replace(/[₱,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
