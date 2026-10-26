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

let realPlayMinimumCents: number | null = null;

/** Core's floor for a real-money game in the site's currency (/api/v1/site); none (null) when the site has no floor. */
export function setRealPlayMinimum(cents: number | null | undefined) {
  realPlayMinimumCents = typeof cents === "number" && cents > 0 ? cents : null;
}

/**
 * "₱5" — playing for real money needs MORE than this in the balance (owner 2026-10-26), and free spins are credited
 * only after the first real-money game. Null when the site has no floor: the copy then leaves the amount out.
 */
export const realPlayMinimum = (): string | null => (realPlayMinimumCents === null ? null : pesoWhole(realPlayMinimumCents));

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

/**
 * A round amount in a NAMED currency, the way `pesoWhole` writes the site's: "₱500", "₱1,250.50". A service that
 * answers with its own currency (the Lucky Wheel's prizes) is written in that one; none, or the site's, is `pesoWhole`.
 */
export function wholeIn(cents: number, currency?: string | null): string {
  const c = currency?.trim().toUpperCase();
  if (!c || c === SKIN_CURRENCY) return pesoWhole(cents);
  const sign = symbolOf(c);
  return cents % 100 === 0
    ? sign + (cents / 100).toLocaleString("en-PH")
    : sign + (cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
