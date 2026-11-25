/**
 * What a dead address most likely pointed at, so the not-found page can say so and offer the closest live thing
 * (owner 2026-11-25). The old site's addresses count too — `/promotions/{id}`, `/bonuses`, `/casino/game/…` are still
 * in search results and old shares. `seo/head.gotmpl` sorts paths the same way (its `$missing`) for the 404's tags.
 */
export type Missing = "promotion" | "game" | "page";

export function missingKind(pathname: string): Missing {
  const path = pathname.toLowerCase();
  if (/^\/(promotions?|bonuses|promo)(\/|$)/.test(path)) return "promotion";
  if (/^\/(games?|casino)(\/|$)/.test(path)) return "game";
  return "page";
}
