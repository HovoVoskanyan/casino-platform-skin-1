/**
 * The site facts every page's search tags share — read by the page (`src/lib/seo.ts`, the routes) AND by the build,
 * which bakes them into the server-side head template (`seo/head.gotmpl`, see `seo/vite-plugin.ts`). No imports, so
 * the Vite config can load this file without the app.
 */
export const BRAND = "ChoCho";

/** The picture a page without its own shows in a link preview. */
export const DEFAULT_IMAGE = "/games-banner.webp";

export const LOGO = "/chocho-logo-cut.png";

/** The languages the site's copy is written in (JSON-LD `inLanguage`). */
export const IN_LANGUAGE = ["en-PH", "fil"];

/** Curated lists, not kinds of game: "a Popular game" says nothing to a search engine, "a Slots game" does. */
export const COLLECTIONS = ["all", "popular", "new", "hot", "top", "featured", "recommended", "trending", "favourites"];
