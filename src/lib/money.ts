/**
 * Money as the ChoCho design writes it. A site holds ONE currency (owner 2026-10-13: single-currency skins), set in
 * the back office and read from core's /api/v1/site before the first render (`setSkinCurrency`); PHP until then.
 * There is no currency picker anywhere — a launch, a deposit and a withdrawal all name this one. A live binding:
 * every reader sees the site's currency once it is known.
 */
export let SKIN_CURRENCY = "PHP";
let symbol = "₱";

/** The currency's sign as en-PH writes it (₱ for PHP, $ for USD, € for EUR); the code itself when it has none. */
function symbolOf(currency: string): string {
  try {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function setSkinCurrency(code: string) {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(c)) return;
  SKIN_CURRENCY = c;
  symbol = symbolOf(c);
}

/** The design's `peso(n)`: ₱12,480.50 — the sign glued to the number, two decimals, en-PH grouping. */
export const peso = (cents: number | string) =>
  symbol + (Number(cents) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Terms and offers write round amounts without decimals — "₱500", "up to ₱1,000" — and anything else as `peso`. */
export const pesoWhole = (cents: number) =>
  cents % 100 === 0 ? symbol + (cents / 100).toLocaleString("en-PH") : peso(cents);

/** The site currency's sign on its own (an amount field's prefix). */
export const currencySymbol = () => symbol;

/** What a hidden balance reads as (six U+2022), wherever the shared Hide balance setting applies. */
export const MASKED = "••••••";

/** Whole pesos typed by a player → cents; null when it is not an amount (the form says so). */
export function toCents(text: string): number | null {
  // the site's sign (and ₱, which players type out of habit), grouping commas and spaces — anything else is not an amount
  const cleaned = text.replace(/[,\s]/g, "").replace(symbol, "").replace("₱", "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
