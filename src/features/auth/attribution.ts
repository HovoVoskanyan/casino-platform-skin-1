/**
 * Affiliate attribution captured from the landing URL (P3-16) and handed to identity at signup as the
 * `externaldatakey` header (parity with the monolith's affiliate hash) plus `X-Source`. Kept for the session in
 * sessionStorage so a player who lands on a promo link, browses, then registers is still attributed.
 */
const KEY = "chocho.attribution";

export interface Attribution {
  affiliate: string | null;
  source: string | null;
}

export function captureAttribution(search: string = window.location.search): Attribution {
  const q = new URLSearchParams(search);
  const affiliate = q.get("externaldatakey") ?? q.get("aff") ?? q.get("affiliate");
  const source = q.get("source") ?? q.get("utm_source");
  if (affiliate || source) {
    const value: Attribution = { affiliate, source };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
    return value;
  }
  return readAttribution();
}

export function readAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Attribution;
  } catch {
    /* ignore */
  }
  return { affiliate: null, source: null };
}
