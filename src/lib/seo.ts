import { useEffect } from "react";
import i18n from "i18next";
import { BRAND, DEFAULT_IMAGE } from "./seo-site";

/**
 * What a page tells search engines and link previews (owner 2026-10-15): title, description, keywords, canonical
 * address, Open Graph / Twitter card, robots and JSON-LD. The site is a single-page app, so this runs in the browser —
 * Google renders JavaScript before indexing. For crawlers that do not (Bing, Facebook, Messenger, Viber, Telegram…)
 * the container's Caddy fills the same tags into `index.html` from `seo/head.gotmpl`; `seoHead` below is the one
 * description of those tags both sides keep to, and `seo/parity.test.ts` holds the server to it.
 *
 * One page owns the head at a time: a page sets it while mounted and puts the site defaults back when it leaves, so a
 * page without its own SEO never inherits the last game's.
 */
export interface Seo {
  /** The page's own title; " | ChoCho" is added unless `bare`. */
  title: string;
  description?: string;
  /** Site path (with any query) of the canonical address; the current path when left out. */
  path?: string;
  image?: string | null;
  keywords?: string[];
  jsonLd?: object | object[];
  noindex?: boolean;
  type?: "website" | "article";
  bare?: boolean;
}

/** The head a page's `Seo` comes to: what `applySeo` writes, and what the server-side template writes too. */
export interface SeoHead {
  title: string;
  /** `[attribute, key, content]` — attribute is `name` or `property`; a tag left out is not on the page. */
  meta: [attribute: "name" | "property", key: string, content: string][];
  canonical: string | null;
  jsonLd: object | null;
}

export { BRAND };
const JSON_LD_ID = "seo-jsonld";

/** The site's own copy (the Home page's), in the page's language: what a page without its own SEO shows. */
const defaults = () => ({ title: i18n.t("seo.home.title"), description: i18n.t("seo.home.description") });

export function useSeo(seo: Seo | null) {
  const key = seo ? JSON.stringify(seo) : "";
  useEffect(() => {
    if (!key) return;
    applySeo(JSON.parse(key) as Seo);
    return resetSeo;
  }, [key]);
}

/** Absolute URL on this site for a site path or an already absolute URL. */
export const absoluteUrl = (pathOrUrl: string) => new URL(pathOrUrl, window.location.origin).href;

export function seoHead(seo: Seo): SeoHead {
  const title = seo.bare ? seo.title : `${seo.title} | ${BRAND}`;
  const description = seo.description ?? defaults().description;
  const url = absoluteUrl(seo.path ?? window.location.pathname);
  const image = absoluteUrl(seo.image || DEFAULT_IMAGE);
  const keywords = seo.keywords?.length ? [...new Set(seo.keywords.filter(Boolean))].join(", ") : null;
  const keywordsTag: SeoHead["meta"] = keywords ? [["name", "keywords", keywords]] : [];
  return {
    title,
    meta: [
      ["name", "description", description],
      ...keywordsTag,
      ["name", "robots", seo.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"],
      ["property", "og:site_name", BRAND],
      ["property", "og:type", seo.type ?? "website"],
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["property", "og:url", url],
      ["property", "og:image", image],
      ["name", "twitter:card", "summary_large_image"],
      ["name", "twitter:title", title],
      ["name", "twitter:description", description],
      ["name", "twitter:image", image],
    ],
    canonical: seo.noindex ? null : url,
    jsonLd: seo.jsonLd ? (Array.isArray(seo.jsonLd) ? { "@context": "https://schema.org", "@graph": seo.jsonLd } : { "@context": "https://schema.org", ...seo.jsonLd }) : null,
  };
}

export function applySeo(seo: Seo) {
  const head = seoHead(seo);
  document.title = head.title;
  meta("name", "keywords", null);
  for (const [attribute, key, content] of head.meta) meta(attribute, key, content);
  link("canonical", head.canonical);
  jsonLd(head.jsonLd);
}

export function resetSeo() {
  const site = defaults();
  document.title = site.title;
  meta("name", "description", site.description);
  meta("name", "keywords", null);
  meta("name", "robots", null);
  link("canonical", null);
  for (const p of ["og:type", "og:title", "og:description", "og:url", "og:image"]) meta("property", p, null);
  for (const n of ["twitter:title", "twitter:description", "twitter:image"]) meta("name", n, null);
  jsonLd(null);
}

function meta(attribute: "name" | "property", key: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (content === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function link(rel: string, href: string | null) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

function jsonLd(data: object | null) {
  // the server-side head's block too: it carries the same id, so the page takes it over
  let tag = document.getElementById(JSON_LD_ID);
  if (data === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("script");
    tag.id = JSON_LD_ID;
    tag.setAttribute("type", "application/ld+json");
    document.head.appendChild(tag);
  }
  // "</" can never close the script early, whatever a game's name holds
  tag.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
}
