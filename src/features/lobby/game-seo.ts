import type { TFunction } from "i18next";
import { absoluteUrl, type Seo } from "@/lib/seo";
import { gamePath } from "@/lib/slug";
import { COLLECTIONS, IN_LANGUAGE } from "@/lib/seo-site";
import type { GameDetail } from "./api";

/**
 * A game page's search copy (owner 2026-10-15), built from what the catalogue knows — name, provider, category, RTP,
 * volatility, demo — so every one of the skin's games gets its own title, description and keywords without an
 * operator writing thousands of blurbs. An operator's own description (the back office's curation) still leads the
 * page; the generated "about" copy stands in only where there is none.
 */
export function gameSeo(t: TFunction, game: GameDetail, category?: string): Seo {
  const path = gamePath(game);
  const facts = [
    game.rtp != null ? t("seo.game.rtp", { rtp: game.rtp }) : null,
    game.volatility ? t("seo.game.volatility", { volatility: game.volatility.toLowerCase() }) : null,
  ].filter(Boolean);
  const description = [
    t("seo.game.lead", { name: game.name, provider: game.providerName }),
    facts.length ? `${capitalise(facts.join(", "))}.` : null,
    t(game.hasDemo ? "seo.game.demo" : "seo.game.real"),
  ].filter(Boolean).join(" ");
  const image = game.logoUrl ?? game.thumbnailUrl;
  return {
    title: t("seo.game.title", { name: game.name, provider: game.providerName }),
    description,
    path,
    image,
    type: "article",
    keywords: [
      game.name,
      t("seo.game.kwOnline", { name: game.name }),
      game.hasDemo ? t("seo.game.kwDemo", { name: game.name }) : null,
      game.rtp != null ? t("seo.game.kwRtp", { name: game.name }) : null,
      category ? `${game.name} ${category}` : null,
      game.providerName,
      t("seo.game.kwProvider", { provider: game.providerName }),
      category ?? null,
      t("seo.keywords.site"),
    ].filter((k): k is string => Boolean(k)),
    jsonLd: [
      {
        "@type": "VideoGame",
        name: game.name,
        url: absoluteUrl(path),
        description,
        ...(image ? { image: absoluteUrl(image) } : {}),
        ...(category ? { genre: category } : {}),
        gamePlatform: "Web browser",
        applicationCategory: "Game",
        operatingSystem: "Any",
        publisher: { "@type": "Organization", name: game.providerName },
        inLanguage: IN_LANGUAGE,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("nav.home"), item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: t("nav.games"), item: absoluteUrl("/games") },
          { "@type": "ListItem", position: 3, name: game.name, item: absoluteUrl(path) },
        ],
      },
    ],
  };
}

/** The page's "About this game" paragraphs when the operator wrote none. */
export function gameAbout(t: TFunction, game: GameDetail, category?: string): string[] {
  const volatility = game.volatility?.toLowerCase();
  return [
    category
      ? t("game.seoAbout.intro", { name: game.name, provider: game.providerName, category })
      : t("game.seoAbout.introNoCategory", { name: game.name, provider: game.providerName }),
    game.rtp != null && volatility
      ? t("game.seoAbout.stats", { rtp: game.rtp, volatility })
      : game.rtp != null
        ? t("game.seoAbout.statsRtp", { rtp: game.rtp })
        : volatility
          ? t("game.seoAbout.statsVolatility", { volatility })
          : null,
    t(game.hasDemo ? "game.seoAbout.demo" : "game.seoAbout.noDemo", { name: game.name }),
    t("game.seoAbout.payments"),
  ].filter((p): p is string => Boolean(p));
}

const collections = new Set(COLLECTIONS);

/** The category that names what kind of game this is — its first shown category that is not a curated list. */
export function seoCategory(categories: { code: string; name: string }[], codes: string[]): string | undefined {
  const mine = categories.filter((c) => codes.includes(c.code));
  return (mine.find((c) => !collections.has(c.code)) ?? mine[0])?.name;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
