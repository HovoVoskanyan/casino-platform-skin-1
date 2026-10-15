import { BRAND, COLLECTIONS, DEFAULT_IMAGE, IN_LANGUAGE, LOGO } from "../lib/seo-site";

/**
 * The build step that turns `index.html` into the Go template the container's Caddy fills per request (owner
 * 2026-10-15): crawlers and link previews that do not run JavaScript get each page's own title, description,
 * canonical, Open Graph and JSON-LD, written from core's facts (`GET /api/v1/seo/page`) with THIS site's copy — the
 * i18n catalogue, baked in at build time, so a copy change ships with the build like every other string.
 *
 * `index.html` marks where the parts go: the facts right after the doctype (Go needs them before `<html lang>`), the
 * head between `<!-- seo:head -->` and `<!-- /seo:head -->` (the site-wide defaults the dev server keeps), and the
 * body's `<noscript>` at `<!-- seo:body -->`. Dev (`vite`) never runs this: the page sets its tags in the browser.
 */
/** An i18n catalogue as its JSON file holds it — flat keys; a few (the info pages) hold objects the template never reads. */
export type Catalogue = Record<string, unknown>;

/** Languages the template can pick, the first being the fallback for keys a language lacks (i18next's fallbackLng). */
const LANGUAGES = ["en-PH", "fil"] as const;

/**
 * Every catalogue key the template reads — each quoted `area.key` literal in it (`index $c "seo.home.title"`, the
 * pairs a `ternary` picks from, the private pages' titles). Every one must be in the catalogue: the build fails on a
 * typo instead of shipping a page with an empty title.
 */
export function templateKeys(template: string): string[] {
  return [...new Set([...template.matchAll(/"([a-z]+(?:\.[A-Za-z]+)+)"/g)].map((m) => m[1]!))].sort();
}

/** The copy the template carries: the keys it reads, per language, a missing translation falling back to English. */
export function templateCopy(template: string, catalogues: Record<(typeof LANGUAGES)[number], Catalogue>) {
  const keys = templateKeys(template);
  const base = catalogues[LANGUAGES[0]];
  const missing = keys.filter((k) => typeof base[k] !== "string");
  if (missing.length) throw new Error(`seo/head.gotmpl reads keys en-PH does not have: ${missing.join(", ")}`);
  const pick = (catalogue: Catalogue, k: string) => (typeof catalogue[k] === "string" ? (catalogue[k] as string) : (base[k] as string));
  return Object.fromEntries(LANGUAGES.map((lng) => [lng, Object.fromEntries(keys.map((k) => [k, pick(catalogues[lng], k)]))]));
}

/** Puts `value`'s JSON in the template's Go raw string `` `name` `` — which holds anything but a backtick. */
function fill(template: string, name: string, value: unknown): string {
  const json = JSON.stringify(value);
  if (json.includes("`")) throw new Error(`seo/head.gotmpl: ${name} holds a backtick, which a Go raw string cannot`);
  const slot = "`" + name + "`";
  if (template.split(slot).length !== 2) throw new Error(`seo/head.gotmpl must hold ${slot} exactly once`);
  return template.replace(slot, () => "`" + json + "`");
}

export function serverHead(indexHtml: string, template: string, catalogues: Record<(typeof LANGUAGES)[number], Catalogue>): string {
  const site = { brand: BRAND, defaultImage: DEFAULT_IMAGE, logo: LOGO, inLanguage: IN_LANGUAGE, collections: COLLECTIONS };
  const filled = fill(fill(template, "__SITE__", site), "__COPY__", templateCopy(template, catalogues));
  const [facts, head, body] = split(filled);
  if (indexHtml.includes("{{")) throw new Error("index.html holds {{ — Caddy's templates would read it as Go template");
  const doctype = /^<!doctype html>/i;
  const headBlock = /<!-- seo:head -->[\s\S]*?<!-- \/seo:head -->/;
  const bodyMark = "<!-- seo:body -->";
  const htmlLang = /<html lang="[^"]*">/;
  for (const [what, ok] of [["doctype", doctype.test(indexHtml)], ["seo:head block", headBlock.test(indexHtml)], ["seo:body mark", indexHtml.includes(bodyMark)], ["<html lang>", htmlLang.test(indexHtml)]] as const) {
    if (!ok) throw new Error(`index.html has no ${what} for the server-side head`);
  }
  return indexHtml
    .replace(doctype, (d) => d + facts)
    .replace(htmlLang, '<html lang="{{ $lang }}">')
    .replace(headBlock, () => head.trim())
    .replace(bodyMark, () => body.trim());
}

function split(template: string): [string, string, string] {
  const [facts, rest] = template.split("\n@@head\n");
  const [head, body] = (rest ?? "").split("\n@@body\n");
  if (facts === undefined || head === undefined || body === undefined) throw new Error("seo/head.gotmpl lost its @@head / @@body lines");
  return [facts.trim(), head, body];
}
