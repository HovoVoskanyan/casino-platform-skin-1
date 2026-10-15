import type { TFunction } from "i18next";
import { absoluteUrl, type Seo } from "@/lib/seo";
import { BRAND, IN_LANGUAGE, LOGO } from "@/lib/seo-site";

/**
 * The lobby pages' search copy (owner 2026-10-15), as plain functions of the catalogue so the page and the
 * server-side head (`seo/head.gotmpl`) can be held to the same output — `seo/parity.test.ts` runs both.
 */
export function homeSeo(t: TFunction): Seo {
  return {
    title: t("seo.home.title"),
    bare: true,
    description: t("seo.home.description"),
    path: "/",
    keywords: t("seo.home.keywords").split(", "),
    jsonLd: [
      { "@type": "WebSite", name: BRAND, url: absoluteUrl("/"), inLanguage: IN_LANGUAGE },
      { "@type": "Organization", name: BRAND, url: absoluteUrl("/"), logo: absoluteUrl(LOGO) },
    ],
  };
}

export function promotionsSeo(t: TFunction): Seo {
  return { title: t("promotions.title"), description: t("seo.promotions.description"), path: "/promotions", keywords: t("seo.promotions.keywords").split(", ") };
}

export function vipSeo(t: TFunction): Seo {
  return { title: t("vip.title"), description: t("seo.vip.description"), path: "/vip" };
}

/** The Games page's filters as far as its search copy goes. */
export interface GamesSeoSearch {
  q?: string;
  category?: string;
  provider?: string;
  badge?: string;
  fav?: boolean;
}

interface Pill {
  code: string;
  name: string;
  gameCount: number;
}

/**
 * The Games page's search copy. A view filtered to ONE category or ONE provider is a landing page of its own — its
 * title, description and canonical address name it (the sitemap lists them); any other view (a search, a badge, a
 * sort, a mix) is the Games page itself as far as search engines go.
 */
export function gamesSeo(t: TFunction, search: GamesSeoSearch, categories: Pill[], providers: Pill[]): Seo {
  const only = !search.q && !search.badge && !search.fav;
  const category = only && !search.provider ? categories.find((c) => c.code === search.category) : undefined;
  const provider = only && !search.category ? providers.find((p) => p.code === search.provider) : undefined;
  const crumbs = (name?: string, path?: string) => ({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("nav.home"), item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: t("nav.games"), item: absoluteUrl("/games") },
      ...(name && path ? [{ "@type": "ListItem", position: 3, name, item: absoluteUrl(path) }] : []),
    ],
  });
  if (category) {
    const path = `/games?category=${encodeURIComponent(category.code)}`;
    return {
      title: t("seo.games.categoryTitle", { category: category.name }),
      description: t("seo.games.categoryDescription", { category: category.name, count: category.gameCount }),
      path,
      keywords: [category.name, `${category.name} online`, t("seo.keywords.site"), ...providers.slice(0, 5).map((p) => p.name)],
      jsonLd: crumbs(category.name, path),
    };
  }
  if (provider) {
    const path = `/games?provider=${encodeURIComponent(provider.code)}`;
    return {
      title: t("seo.games.providerTitle", { provider: provider.name }),
      description: t("seo.games.providerDescription", { provider: provider.name, count: provider.gameCount }),
      path,
      keywords: [provider.name, t("seo.game.kwProvider", { provider: provider.name }), t("seo.keywords.site")],
      jsonLd: crumbs(provider.name, path),
    };
  }
  return {
    title: t("seo.games.title"),
    description: t("seo.games.description"),
    path: "/games",
    keywords: [...t("seo.games.keywords").split(", "), ...categories.map((c) => c.name), ...providers.slice(0, 8).map((p) => p.name)],
    jsonLd: crumbs(),
  };
}
