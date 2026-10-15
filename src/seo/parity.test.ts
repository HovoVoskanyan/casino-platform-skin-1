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
import { gamesSeo, homeSeo, promotionsSeo, vipSeo } from "@/features/lobby/page-seo";
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
const providers = Array.from({ length: 10 }, (_, i) => ({ code: `prov-${i}`, name: `Provider "${i}"`, thumbnailUrl: null, tag: null, gameCount: 30 - i }));
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
    const html = await (await fetch(`http://127.0.0.1:${port}${path}`, { headers: { "User-Agent": "facebookexternalhit/1.1" } })).text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const meta = [...doc.head.querySelectorAll("meta[name], meta[property]")]
      .map((m) => [m.hasAttribute("name") ? "name" : "property", m.getAttribute("name") ?? m.getAttribute("property")!, m.getAttribute("content")!] as const)
      .filter(([, key]) => !["viewport", "color-scheme", "theme-color", "og:locale"].includes(key));
    const ld = doc.getElementById("seo-jsonld")?.textContent;
    const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "";
    const copy = [...new DOMParser().parseFromString(noscript, "text/html").body.querySelectorAll("h1, p")].map((e) => e.textContent);
    return {
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

  it("a game the skin does not show is unavailable and kept out of the index", async () => {
    const tt = await t("en-PH");
    window.history.replaceState(null, "", `/games/${"f".repeat(8)}-0000-0000-0000-000000000000`);
    const page = await crawl(`/games/${"f".repeat(8)}-0000-0000-0000-000000000000`);
    expect(page.head).toEqual(expected({ title: tt("game.unavailable"), noindex: true }));
    expect(page.copy).toEqual([]);
    window.history.replaceState(null, "", "/");
  });

  it("Home, Promotions and VIP", async () => {
    const tt = await t("en-PH");
    expect((await crawl("/")).head).toEqual(expected(homeSeo(tt)));
    expect((await crawl("/promotions")).head).toEqual(expected(promotionsSeo(tt)));
    expect((await crawl("/vip")).head).toEqual(expected(vipSeo(tt)));
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

  it("when core cannot answer the page still renders, with the site-wide defaults", async () => {
    const page = await crawl("/games/broken");
    expect(page.head.title).toBe(en["seo.home.title"]);
    expect(page.head.meta).toContainEqual(["name", "description", en["seo.home.description"]]);
    expect(page.head.canonical).toBeNull();
    expect(page.raw).toContain('<div id="root"></div>');
  });
});
