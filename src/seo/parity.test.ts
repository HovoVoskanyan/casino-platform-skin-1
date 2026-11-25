// @vitest-environment-options { "url": "https://chocho.test/" }
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { http as msw, passthrough } from "msw";
import template from "./head.gotmpl?raw";
import indexHtml from "../../index.html?raw";
import en from "@/i18n/locales/en-PH.json";
import fil from "@/i18n/locales/fil.json";
import i18n from "@/i18n";
import { server } from "@/test/server";
import { seoHead, type Seo, type SeoHead } from "@/lib/seo";
import { gameAbout, gameSeo, seoCategory } from "@/features/lobby/game-seo";
import { gamesSeo, homeSeo, infoSeo, INFO_PAGES, notFoundSeo, promotionsSeo, vipSeo, wheelSeo } from "@/features/lobby/page-seo";
import type { GameDetail } from "@/features/lobby/api";
import { serverHead } from "./server-head";

/**
 * The server-side head must say what the page says (owner 2026-10-15). This runs the REAL thing: the build's
 * index.html template in the container's Caddy image with the repo's Caddyfile, its sub-request answered by a stand-in
 * gateway serving core's page facts — and compares every tag with what `seoHead` makes of the page's own Seo for the
 * same catalogue. It needs docker, so it runs on demand: `npm run test:seo`.
 */
const ORIGIN = "https://chocho.test";
const GAME = "0e0c5a9e-1b2c-4d3e-8f90-123456789abc";
const PLAIN = "0e0c5a9e-1b2c-4d3e-8f90-123456789abd";

const categories = [
  { code: "popular", name: "Popular", thumbnailUrl: null, gameCount: 10 },
  { code: "slots", name: "Slots & <Reels>", thumbnailUrl: null, gameCount: 42 },
  { code: "live", name: "Live Casino", thumbnailUrl: null, gameCount: 7 },
];
const providers = Array.from({ length: 10 }, (_, i) => ({ code: `prov-${i}`, name: `Provider "${i}"`, thumbnailUrl: null, showName: true, tag: null, gameCount: 30 - i }));
const games: Record<string, GameDetail> = {
  [GAME]: {
    id: GAME, name: "Sweet <Bonanza> \"1000\" & Co", providerCode: "prov-0", providerName: "Provider \"0\"", thumbnailUrl: "https://cdn.example/t.png",
    logoUrl: null, hasDemo: true, badges: [], categories: ["popular", "slots"], description: null, rtp: 96.5, volatility: "High",
  },
  [PLAIN]: {
    id: PLAIN, name: "Ünïcödé Crash", providerCode: "prov-1", providerName: "Provider \"1\"", thumbnailUrl: null,
    logoUrl: "/media/logo.png", hasDemo: false, badges: [], categories: ["popular"], description: "The operator's own words.", rtp: null, volatility: null,
  },
};
const slugs: Record<string, string> = { [GAME]: "sweet-bonanza-1000-co", [PLAIN]: "unicode-crash" };

let language = "en-ph";
const facts = (game: string | null) => ({
  origin: ORIGIN,
  language,
  game: game ? (games[game] ?? null) : null,
  gamePath: game && games[game] ? `/games/${game}/${slugs[game]}` : null,
  categories,
  providers,
});

let stub: Server;
let port = 0;
let srv = "";
const container = `seo-parity-${process.pid}`;

const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

describe.runIf(process.env.SEO_PARITY === "1")("the server-side head says what the page says", () => {
  beforeAll(async () => {
    stub = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://stub");
      if (url.pathname !== "/api/v1/seo/page") {
        res.writeHead(404).end();
        return;
      }
      if (url.searchParams.get("game") === "broken") {
        res.writeHead(500).end("boom");
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(facts(url.searchParams.get("game"))));
    });
    await new Promise<void>((resolve) => stub.listen(0, "0.0.0.0", resolve));
    const gateway = (stub.address() as AddressInfo).port;

    srv = mkdtempSync(join(tmpdir(), "seo-parity-"));
    writeFileSync(join(srv, "index.html"), serverHead(indexHtml, template, { "en-PH": en, fil: fil }));
    docker("rm", "-f", container);
    docker(
      "run", "-d", "--name", container, "--add-host=host.docker.internal:host-gateway",
      "-e", `GATEWAY_UPSTREAM=host.docker.internal:${gateway}`, "-p", "127.0.0.1::80",
      "-v", `${join(process.cwd(), "Caddyfile")}:/etc/caddy/Caddyfile:ro`, "-v", `${srv}:/srv:ro`, "caddy:2-alpine",
    );
    port = Number(docker("port", container, "80/tcp").trim().split(":").pop());
    server.use(msw.all("*", () => passthrough()));
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/vip`)).ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }, 120_000);

  afterAll(() => {
    try {
      docker("rm", "-f", container);
    } catch {
      /* already gone */
    }
    stub?.close();
    if (srv) rmSync(srv, { recursive: true, force: true });
  });

  beforeEach(() => {
    server.use(msw.all("*", () => passthrough()));
    language = "en-ph";
  });

  /** What a crawler reads: the head's search tags (the site-wide static ones included) and the noscript copy. */
  async function crawl(path: string) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { "User-Agent": "facebookexternalhit/1.1" } });
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const meta = [...doc.head.querySelectorAll("meta[name], meta[property]")]
      .map((m) => [m.hasAttribute("name") ? "name" : "property", m.getAttribute("name") ?? m.getAttribute("property")!, m.getAttribute("content")!] as const)
      .filter(([, key]) => !["viewport", "color-scheme", "theme-color", "og:locale"].includes(key));
    const ld = doc.getElementById("seo-jsonld")?.textContent;
    const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "";
    const noscriptDoc = new DOMParser().parseFromString(noscript, "text/html");
    const copy = [...noscriptDoc.body.querySelectorAll("h1, p")].map((e) => e.textContent);
    const links = [...noscriptDoc.body.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    return {
      status: response.status,
      links,
      lang: doc.documentElement.lang,
      head: { title: doc.title, meta: sorted(meta), canonical: doc.head.querySelector("link[rel=canonical]")?.getAttribute("href") ?? null, jsonLd: ld ? (JSON.parse(ld) as object) : null },
      copy,
      raw: html,
    };
  }

  /** The page's own tags for `seo` — `seoHead` plus the static ones index.html carries (og:site_name, twitter:card). */
  const expected = (seo: Seo): SeoHead => {
    const head = seoHead(seo);
    return { ...head, meta: sorted(head.meta) };
  };
  const sorted = (meta: readonly (readonly [string, string, string])[]) =>
    [...meta].map((m) => [...m] as [SeoHead["meta"][number][0], string, string]).sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));

  async function t(lng: "en-PH" | "fil") {
    await i18n.changeLanguage(lng);
    return i18n.getFixedT(lng);
  }

  it("a game page: title, description, keywords, canonical, og:image, JSON-LD and the about copy", async () => {
    const tt = await t("en-PH");
    const game = games[GAME]!;
    const kind = seoCategory(categories, game.categories);
    const page = await crawl(`/games/${GAME}/an-old-slug?play=demo`);
    expect(page.head).toEqual(expected(gameSeo(tt, game, kind)));
    expect(page.head.canonical).toBe(`${ORIGIN}/games/${GAME}/sweet-bonanza-1000-co`);
    expect(page.copy).toEqual([game.name, ...gameAbout(tt, game, kind)]);
    expect(page.lang).toBe("en-PH");
    expect(page.raw).not.toContain("<Bonanza>"); // escaped, never markup
  });

  it("a game without maths, demo or a picture of its own, with the operator's description", async () => {
    const tt = await t("en-PH");
    const game = games[PLAIN]!;
    const page = await crawl(`/games/${PLAIN}`);
    expect(page.head).toEqual(expected(gameSeo(tt, game, seoCategory(categories, game.categories))));
    expect(page.head.meta).toContainEqual(["property", "og:image", `${ORIGIN}/media/logo.png`]);
    expect(page.copy).toEqual([game.name, "The operator's own words."]);
  });

  it("a game the skin does not show is a 404 — the not-found page for a game, kept out of the index", async () => {
    const tt = await t("en-PH");
    const path = `/games/${"f".repeat(8)}-0000-0000-0000-000000000000`;
    window.history.replaceState(null, "", path);
    const page = await crawl(path);
    expect(page.status).toBe(404);
    expect(page.head).toEqual(expected(notFoundSeo(tt, "game")));
    expect(page.copy.slice(0, 2)).toEqual([tt("notFound.game.title"), tt("notFound.game.body")]);
    window.history.replaceState(null, "", "/");
  });

  it("an address the front has no page for is a 404 that says what is gone and links on — the old site's too", async () => {
    const tt = await t("en-PH");
    for (const [path, missing] of [
      ["/promotions/a399ce21-c434-48e2-8d51-3149516e268b", "promotion"],
      ["/bonuses", "promotion"],
      ["/casino/game/sweet-bonanza", "game"],
      ["/no/such/page?x=1", "page"],
    ] as const) {
      window.history.replaceState(null, "", path);
      const page = await crawl(path);
      expect([path, page.status]).toEqual([path, 404]);
      expect(page.head).toEqual(expected(notFoundSeo(tt, missing)));
      expect(page.copy.slice(0, 2)).toEqual([tt(`notFound.${missing}.title`), tt(`notFound.${missing}.body`)]);
      expect(page.links).toEqual(["/promotions", "/games", "/vip", "/"]);
      expect(page.raw).toContain('<div id="root"></div>'); // people get the app, which shows the designed page
    }
    window.history.replaceState(null, "", "/");
  });

  it("every page the front has is a 200 — either case, a trailing slash, and the ones served as built", async () => {
    for (const path of ["/", "/promotions/", "/Promotions", "/vip", "/lucky-wheel", "/info/terms", "/wallet", `/games/${GAME}/x`]) {
      expect([path, (await crawl(path)).status]).toEqual([path, 200]);
    }
  });

  it("a dead address in Filipino on a Filipino site", async () => {
    language = "fil";
    const tt = await t("fil");
    const page = await crawl("/promotions/old-one");
    expect(page.lang).toBe("fil");
    expect(page.head.title).toBe(`${tt("notFound.promotion.title")} | ChoCho`);
    await t("en-PH");
  });

  it("Home, Promotions, VIP and the Lucky Wheel", async () => {
    const tt = await t("en-PH");
    expect((await crawl("/")).head).toEqual(expected(homeSeo(tt)));
    expect((await crawl("/promotions")).head).toEqual(expected(promotionsSeo(tt)));
    expect((await crawl("/vip")).head).toEqual(expected(vipSeo(tt)));
    expect((await crawl("/lucky-wheel")).head).toEqual(expected(wheelSeo(tt)));
  });

  it("every spelling of a page gets its own tags and its one canonical address", async () => {
    const tt = await t("en-PH");
    for (const path of ["/Promotions", "/promotions/"]) expect([path, (await crawl(path)).head]).toEqual([path, expected(promotionsSeo(tt))]);
    expect((await crawl("/Games/")).head).toEqual(expected(gamesSeo(tt, {}, categories, providers)));
  });

  it("the Info documents, each in its own words — and one the front does not have is a 404", async () => {
    for (const lng of ["en-PH", "fil"] as const) {
      language = lng === "fil" ? "fil" : "en-ph";
      const tt = await t(lng);
      for (const page of INFO_PAGES) {
        const crawled = await crawl(`/info/${page}`);
        expect([lng, page, crawled.status]).toEqual([lng, page, 200]);
        expect(crawled.head).toEqual(expected(infoSeo(tt, page)));
      }
    }
    await t("en-PH");
    language = "en-ph";
    window.history.replaceState(null, "", "/info/cookies");
    const missing = await crawl("/info/cookies");
    expect(missing.status).toBe(404);
    expect(missing.head).toEqual(expected(notFoundSeo(await t("en-PH"), "page")));
    window.history.replaceState(null, "", "/");
  });

  it("Load More's address: its own canonical and page number — the view's own copy for anything that is not a page", async () => {
    const tt = await t("en-PH");
    expect((await crawl("/games?page=3")).head).toEqual(expected(gamesSeo(tt, { page: 3 }, categories, providers)));
    expect((await crawl("/games?category=slots&page=2")).head).toEqual(expected(gamesSeo(tt, { category: "slots", page: 2 }, categories, providers)));
    expect((await crawl("/games?provider=prov-3&page=12")).head).toEqual(expected(gamesSeo(tt, { provider: "prov-3", page: 12 }, categories, providers)));
    for (const odd of ["1", "1.5", "-2", "x", ""]) {
      expect([odd, (await crawl(`/games?category=slots&page=${odd}`)).head]).toEqual([odd, expected(gamesSeo(tt, { category: "slots" }, categories, providers))]);
    }
  });

  it("the Games page, one category, one provider — and a search is the Games page itself", async () => {
    const tt = await t("en-PH");
    expect((await crawl("/games")).head).toEqual(expected(gamesSeo(tt, {}, categories, providers)));
    expect((await crawl("/games?category=slots")).head).toEqual(expected(gamesSeo(tt, { category: "slots" }, categories, providers)));
    expect((await crawl("/games?provider=prov-3&sort=name")).head).toEqual(expected(gamesSeo(tt, { provider: "prov-3" }, categories, providers)));
    expect((await crawl("/games?category=slots&q=bass")).head).toEqual(expected(gamesSeo(tt, { category: "slots", q: "bass" }, categories, providers)));
    expect((await crawl("/games?category=nope")).head).toEqual(expected(gamesSeo(tt, { category: "nope" }, categories, providers)));
  });

  it("a site whose default is Filipino reads in Filipino", async () => {
    language = "fil";
    const tt = await t("fil");
    const game = games[GAME]!;
    const kind = seoCategory(categories, game.categories);
    const page = await crawl(`/games/${GAME}/x`);
    expect(page.lang).toBe("fil");
    expect(page.head).toEqual(expected(gameSeo(tt, game, kind)));
    expect(page.copy).toEqual([game.name, ...gameAbout(tt, game, kind)]);
    await t("en-PH");
  });

  it("the player's own pages are noindex without asking core", async () => {
    const page = await crawl("/wallet");
    expect(page.head.title).toBe(`${en["wallet.title"]} | ChoCho`);
    expect(page.head.meta).toContainEqual(["name", "robots", "noindex, follow"]);
    expect(page.head.canonical).toBeNull();
  });

  it("when core cannot answer the page still renders, with the site-wide defaults — never a 404", async () => {
    const page = await crawl("/games/broken");
    expect(page.status).toBe(200);
    expect(page.head.title).toBe(en["seo.home.title"]);
    expect(page.head.meta).toContainEqual(["name", "description", en["seo.home.description"]]);
    expect(page.head.canonical).toBeNull();
    expect(page.raw).toContain('<div id="root"></div>');
  });
});
