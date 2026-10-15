/**
 * The readable tail of a game's address — `/games/{id}/{slug}`, from the game's name (owner 2026-10-15: the name in
 * the URL, for search engines). The id stays the key; the slug is decoration the game page puts back when it is
 * missing or stale. **Core derives the same slug for the sitemap** (`Platform.Core.Domain/Rules/GameSlug.cs`) — the
 * sitemap's URLs must be the ones the page calls canonical, so a change here is made there too; both test files share
 * their examples.
 *
 * Latin accents folded by `FOLD` (é → e, ß → ss, æ → ae), A–Z lowercased, every run of anything else becomes one
 * hyphen, none at either end, at most 80 characters (cut at a hyphen when there is one); nothing left → "game". A
 * table, not `normalize("NFD")`: core runs with invariant globalization (no NFD), and a table is what both sides can
 * hold entry for entry.
 */
export const SLUG_MAX = 80;

const FOLD: Record<string, string> = Object.fromEntries(([
  ["a", "àáâãäåāăąÀÁÂÃÄÅĀĂĄ"],
  ["c", "çćĉċčÇĆĈĊČ"],
  ["d", "ďđðĎĐÐ"],
  ["e", "èéêëēĕėęěÈÉÊËĒĔĖĘĚ"],
  ["g", "ĝğġģĜĞĠĢ"],
  ["h", "ĥħĤĦ"],
  ["i", "ìíîïĩīĭįıÌÍÎÏĨĪĬĮİ"],
  ["j", "ĵĴ"],
  ["k", "ķĶ"],
  ["l", "ĺļľŀłĹĻĽĿŁ"],
  ["n", "ñńņňÑŃŅŇ"],
  ["o", "òóôõöøōŏőÒÓÔÕÖØŌŎŐ"],
  ["r", "ŕŗřŔŖŘ"],
  ["s", "śŝşšŚŜŞŠ"],
  ["t", "ţťŧŢŤŦ"],
  ["u", "ùúûüũūŭůűųÙÚÛÜŨŪŬŮŰŲ"],
  ["w", "ŵŴ"],
  ["y", "ýÿŷÝŸŶ"],
  ["z", "źżžŹŻŽ"],
  ["ae", "æÆ"],
  ["oe", "œŒ"],
  ["th", "þÞ"],
  ["ss", "ß"],
] as const).flatMap(([plain, marked]) => [...marked].map((c) => [c, plain])));

export function gameSlug(name: string | null | undefined): string {
  const folded = [...(name ?? "")].map((c) => (/[a-z0-9]/.test(c) ? c : /[A-Z]/.test(c) ? c.toLowerCase() : (FOLD[c] ?? " "))).join("");
  const words = folded.split(/[^a-z0-9]+/).filter(Boolean);
  let slug = words.join("-");
  if (slug.length > SLUG_MAX) {
    const cut = slug.slice(0, SLUG_MAX + 1);
    const lastHyphen = cut.lastIndexOf("-");
    slug = lastHyphen > 0 ? cut.slice(0, lastHyphen) : slug.slice(0, SLUG_MAX);
  }
  return slug || "game";
}

/** A game's canonical address on the site. */
export const gamePath = (game: { id: string; name: string }) => `/games/${game.id}/${gameSlug(game.name)}`;
