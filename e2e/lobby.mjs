// P3-27 browser walk of the lobby pages against the RUNNING laptop stack, through the compose skin front (Caddy →
// gateway), in the installed Chrome. It seeds a throwaway skin on its own host — `p327-<id>.localhost`, which Chrome
// resolves to loopback — over core's HMAC admin surface, so the catalogue it asserts is exactly the one it made.
// Usage: npm run e2e:lobby    (SKIN_PORT=3003, CORE=http://127.0.0.1:5003, COMPOSE_DIR=../casino-platform-backend/deploy)
// Screenshots of Home / Games / game / Promotions at 375 and 1280 land in e2e/shots/ (git-ignored).
import { chromium } from "playwright";
import crypto from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";

const PORT = process.env.SKIN_PORT ?? "3003";
const CORE = process.env.CORE ?? "http://127.0.0.1:5003";
const COMPOSE_DIR = process.env.COMPOSE_DIR ?? "../casino-platform-backend/deploy";
const ACTOR = "00000000-0000-0000-0000-0000000000a1";
const id = Math.random().toString(36).slice(2, 8);
const skin = `p327-${id}`;
const host = `${skin}.localhost`;
const BASE = `http://${host}:${PORT}`;
const SHOTS = "e2e/shots";

const secret = readFileSync(`${COMPOSE_DIR}/.env`, "utf8").split("\n").find((l) => l.startsWith("CORE_HMAC_BACKOFFICE_SECRET="))?.split("=").slice(1).join("=").trim();
if (!secret) throw new Error("CORE_HMAC_BACKOFFICE_SECRET is not in deploy/.env");

async function admin(method, path, body) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const canonical = ["backoffice", ts, nonce, method, path, "", ACTOR, "", raw].join("\n");
  const signature = crypto.createHmac("sha512", secret).update(canonical).digest("hex");
  const res = await fetch(CORE + path, {
    method,
    headers: { "X-App-Id": "backoffice", "X-Timestamp": ts, "X-Nonce": nonce, "X-Signature": signature, "X-Actor-Id": ACTOR, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : raw,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

console.log(`== seed ${skin} on ${host}`);
await admin("POST", "/internal/admin/skins", { id: skin, name: `P3-27 ${id}` });
await admin("PUT", `/internal/admin/skins/${skin}/markets`, { languages: ["en", "fil"], currencies: ["EUR", "PHP"], servedCountries: [], blockedCountries: [] });
await admin("POST", `/internal/admin/skins/${skin}/domains`, { host, isPrimary: true });
const providers = {};
for (const [code, name] of [["pragmatic", "Pragmatic Play"], ["evolution", "Evolution"], ["pgsoft", "PG Soft"]]) {
  providers[code] = await admin("POST", "/internal/admin/providers", { code: `${code}-${id}`, name, aggregator: "fundist", enabled: true, thumbnailUrl: null });
}
const slots = await admin("POST", "/internal/admin/categories", { code: `slots-${id}`, names: { en: "Slots", fil: "Mga Slot" }, description: null, sortOrder: 0, enabled: true });
const live = await admin("POST", "/internal/admin/categories", { code: `live-${id}`, names: { en: "Live Casino" }, description: null, sortOrder: 1, enabled: true });
const names = ["Sweet Bonanza", "Gates of Olympus", "Sugar Rush 1000", "Starlight Princess", "Big Bass Bonanza", "Wild West Gold", "Fruit Party", "Fortune Ox", "Lucky Neko", "Mahjong Ways 2", "Lightning Roulette", "Crazy Time", "Monopoly Live", "Buffalo King"];
const games = [];
for (const [i, name] of names.entries()) {
  const provider = i >= 10 ? providers.evolution : i >= 7 ? providers.pgsoft : providers.pragmatic;
  // one stale thumbnail on purpose: the card must fall back to generated art, never a broken image
  const thumbnailUrl = i === 1 ? "https://cdn.invalid/missing.png" : null;
  const g = await admin("POST", "/internal/admin/games", { providerId: provider.id, code: `g${i}-${id}`, name, launchSystem: "fundist-sys", status: "Active", defaultRtp: 96.5, volatility: "High", hasDemo: true, logoUrl: null, thumbnailUrl });
  await admin("PUT", `/internal/admin/skins/${skin}/games/${g.id}`, { enabled: true, sortOrder: i, description: i === 0 ? "A colourful slot with candy and fruit symbols." : null, searchKeywords: i === 0 ? ["candy"] : [], hot: i < 4 });
  games.push(g);
}
const hidden = await admin("POST", "/internal/admin/games", { providerId: providers.pragmatic.id, code: `hidden-${id}`, name: "Hidden Game", launchSystem: "fundist-sys", status: "Active", defaultRtp: 96, volatility: null, hasDemo: false, logoUrl: null, thumbnailUrl: null });
await admin("PUT", `/internal/admin/skins/${skin}/games/${hidden.id}`, { enabled: false, sortOrder: 99, description: null, searchKeywords: [] });
await admin("POST", `/internal/admin/categories/${slots.id}/games`, { gameIds: games.slice(0, 10).map((g) => g.id) });
await admin("POST", `/internal/admin/categories/${live.id}/games`, { gameIds: games.slice(10).map((g) => g.id) });
await admin("PUT", `/internal/admin/skins/${skin}/categories/${slots.id}`, { enabled: true, sortOrder: 0 });
await admin("PUT", `/internal/admin/skins/${skin}/categories/${live.id}`, { enabled: true, sortOrder: 1 });
const welcome = await admin("POST", `/internal/admin/skins/${skin}/promotions`, { titles: { en: "Welcome Bonus" }, bodies: { en: "Make your first deposit and enjoy extra rewards." }, imageUrl: null, startsAt: null, endsAt: null, status: "Active", sortOrder: 0, category: "welcome", values: { en: "100% up to ₱5,000" }, terms: { en: "Minimum deposit ₱200. Wager 30x within 7 days." } });
await admin("POST", `/internal/admin/skins/${skin}/promotions`, { titles: { en: "Reload Bonus" }, bodies: { en: "Get more value from your next deposit." }, imageUrl: null, startsAt: null, endsAt: null, status: "Active", sortOrder: 1, category: "reload", values: { en: "50% up to ₱3,000" }, terms: {} });
await admin("POST", `/internal/admin/skins/${skin}/promotions`, { titles: { en: "Weekly Cashback" }, bodies: { en: "Get a share back every week." }, imageUrl: null, startsAt: null, endsAt: null, status: "Active", sortOrder: 2, category: "cashback", values: { en: "Up to 10% back" }, terms: {} });
await admin("POST", `/internal/admin/skins/${skin}/banners`, { promotionId: welcome.id, titles: { en: "100% Welcome Bonus up to ₱5,000" }, imageUrl: `${BASE}/chocho-logo-cut.png`, mobileImageUrl: null, placement: "home-hero", startsAt: null, endsAt: null, status: "Active", sortOrder: 0, fit: "Contain" });

console.log("== wait for the gateway's skin map");
// Asked through the skin front itself: Node's fetch drops a hand-set Host header, and resolving the throwaway host
// is exactly what is being waited for. Fails loudly instead of letting the walk start against a host nobody knows.
let known = false;
for (let i = 0; i < 30 && !known; i++) {
  known = (await fetch(`${BASE}/api/v1/games`).catch(() => null))?.status === 200;
  if (!known) await new Promise((r) => setTimeout(r, 1500));
}
if (!known) throw new Error(`the gateway never learned ${host}`);

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const log = [];
page.on("pageerror", (e) => log.push(`[pageerror] ${e.message.slice(0, 300)}`));
// Resource errors in the console are expected answers here (the guest's 401 session probe, the hidden game's 404,
// the deliberately stale thumbnail); what fails the walk is a crash in the page or a 5xx from the platform.
page.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 500) log.push(`[5xx] ${r.request().method()} ${r.url()} → ${r.status()}`); });

let ok = 0;
const step = (name) => { ok++; console.log(`  PASS  ${name}`); };
const shot = async (name) => {
  for (const [w, h] of [[375, 812], [1280, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
};

try {
  console.log("== Home as a guest");
  await page.goto(BASE + "/");
  await page.getByRole("region", { name: "Hot Games" }).getByRole("link", { name: "Sweet Bonanza, Pragmatic Play" }).waitFor({ timeout: 15000 });
  step("Hot Games is the skin's four HOT picks");
  await page.getByRole("link", { name: "Slots, 10 games" }).waitFor();
  step("Quick Play shows the skin's categories with visible counts");
  await page.getByRole("region", { name: "Bonuses" }).getByText("100% up to ₱5,000").waitFor();
  step("Bonuses rail shows the live promotions");
  await page.getByRole("region", { name: "Promotions" }).getByRole("link", { name: "100% Welcome Bonus up to ₱5,000" }).waitFor();
  step("the hero shows the live home-hero banner");
  await shot("home");

  console.log("== Games: filters, search, paging, the hidden game");
  await page.getByRole("link", { name: "Slots, 10 games" }).click();
  await page.waitForURL(/\/games\?category=slots-/);
  const grid = page.getByRole("region", { name: /All Games/ });
  await grid.getByText("10 games").waitFor();
  step("a Quick Play tile opens Games filtered to that category");
  await page.getByRole("button", { name: "All Games" }).click();
  await grid.getByText("14 games").waitFor();
  if ((await grid.getByRole("link", { name: /, (Pragmatic Play|PG Soft|Evolution)$/ }).count()) !== 12) throw new Error("first page is not 12");
  await grid.getByRole("button", { name: "Load More (12 of 14)" }).click();
  await grid.getByRole("link", { name: "Buffalo King, Evolution" }).waitFor();
  step("twelve at a time, Load More brings the rest");
  await page.getByRole("searchbox", { name: "Search games" }).fill("candy");
  await page.waitForURL(/q=candy/);
  await grid.getByText("1 game").waitFor();
  step("search reaches the skin's keywords, debounced into the URL");
  await page.reload();
  await grid.getByRole("link", { name: "Sweet Bonanza, Pragmatic Play" }).waitFor();
  step("a filtered view survives a reload");
  await page.goto(BASE + "/games");
  await page.getByRole("region", { name: "Providers" }).getByRole("button", { name: /Evolution/ }).click();
  await grid.getByText("4 games").waitFor();
  step("a provider tile filters the grid");
  await page.goto(BASE + "/games");
  await grid.getByRole("link", { name: "Gates of Olympus, Pragmatic Play" }).locator("img").count().then((n) => { if (n !== 0) throw new Error("broken thumbnail still an <img>"); });
  step("a stale thumbnail falls back to generated art");
  await shot("games");
  await page.goto(`${BASE}/games/${hidden.id}`);
  await page.getByRole("heading", { name: "This game is unavailable" }).waitFor();
  step("a hidden game's URL reads as unavailable");

  console.log("== game page");
  await page.goto(`${BASE}/games/${games[0].id}`);
  await page.getByRole("heading", { name: "Sweet Bonanza" }).waitFor();
  await page.getByText("A colourful slot with candy and fruit symbols.").waitFor();
  step("the game page shows the skin's about copy");
  await shot("game");

  console.log("== Promotions");
  await page.goto(BASE + "/promotions");
  await page.getByRole("navigation", { name: "Promotion categories" }).getByRole("button", { name: "CASHBACK" }).click();
  await page.getByRole("region", { name: /All Promotions/ }).getByText("Weekly Cashback").waitFor();
  step("category pills come from the live promotions and filter them");
  await page.goto(BASE + "/promotions");
  await page.getByRole("region", { name: /All Promotions/ }).getByText("Weekly Cashback").waitFor();
  await shot("promotions");
  await page.getByRole("region", { name: /All Promotions/ }).getByRole("link", { name: /View Details/ }).first().click();
  await page.getByRole("dialog").getByText("Minimum deposit ₱200. Wager 30x within 7 days.").waitFor();
  step("View Details opens the full terms");
  await page.goto(BASE + "/");
  await page.getByRole("region", { name: "Promotions" }).getByRole("link", { name: "100% Welcome Bonus up to ₱5,000" }).click();
  await page.getByRole("dialog").getByText("Minimum deposit ₱200. Wager 30x within 7 days.").waitFor();
  step("the hero banner opens its promotion's terms");

  console.log("== the ♥");
  await page.goto(BASE + "/games");
  await page.getByRole("button", { name: "Add Lucky Neko to favourites" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).last().waitFor();
  step("a guest's ♥ opens sign-in");
  await page.goto(BASE + "/#register");
  await page.getByRole("tab", { name: "Email" }).click();
  await page.getByLabel("Email address").fill(`p327-${id}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Passw0rd!2345");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("link", { name: "My Account" }).waitFor({ timeout: 15000 });
  await page.goto(BASE + "/games");
  await page.getByRole("button", { name: "Add Lucky Neko to favourites" }).first().click();
  await page.getByRole("region", { name: "Favourite Games" }).getByRole("link", { name: "Lucky Neko, PG Soft" }).waitFor();
  step("a player's ♥ lands on the Favourite Games rail");
  await page.reload();
  await page.getByRole("region", { name: "Favourite Games" }).getByRole("link", { name: "Lucky Neko, PG Soft" }).waitFor();
  step("and survives a reload");
  await grid.getByRole("button", { name: "♥ Favourites", exact: true }).click();
  await page.waitForURL(/fav=true/);
  // toggled, the grid is titled by what it shows: the player's favourites
  await page.getByRole("region", { name: /^Favourite Games/ }).getByRole("link", { name: "Lucky Neko, PG Soft" }).waitFor();
  await page.getByRole("region", { name: /^Favourite Games/ }).getByText("1 game").waitFor();
  step("the favourites-only toggle narrows the grid to the ♥ list");

  if (log.length) throw new Error("browser errors:\n" + log.join("\n"));
  console.log(`\n${ok} passed — screenshots in ${SHOTS}/`);
} catch (e) {
  await page.screenshot({ path: `${SHOTS}/fail.png`, fullPage: true }).catch(() => {});
  console.error("FAILED:", e.message, "\n", log.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
