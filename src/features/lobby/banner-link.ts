/**
 * Where a banner may send a player: a page of the same site, by relative path (owner 2026-10-15). Core's
 * `SiteLinkRules` is the gate and holds the full reasoning; this copy is defence in depth — a link that is not a
 * same-site path is never rendered, so a bad row can at worst leave a banner unclickable, never send a player
 * elsewhere. The back office keeps the third copy (`casino-platform-backoffice/src/features/skins/banner-link.ts`).
 *
 * One leading `/` and not two (`//host` is protocol-relative), no backslash (`/\host` is `//host` to a browser), no
 * whitespace or control characters, the same again after decoding `%xx` (where only an encoded space is fine), at
 * most {@link LINK_MAX} characters. Query and fragment are free.
 */
export const LINK_MAX = 512;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

const sameSite = (path: string, allowSpace: boolean) =>
  path.startsWith("/")
  && path[1] !== "/"
  && path[1] !== "\\"
  && ![...path].some((c) => c === "\\" || CONTROL.test(c) || (/\s/.test(c) && !(allowSpace && c === " ")));

/** One decode of the ASCII escapes, as a router would; a malformed escape stays as written. */
const decode = (path: string) => path.replace(/%([0-7][0-9a-f])/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

export function isSiteLink(raw: string | null | undefined): raw is string {
  const path = (raw ?? "").trim();
  return path.length > 0 && path.length <= LINK_MAX && sameSite(path, false) && sameSite(decode(path), true);
}

