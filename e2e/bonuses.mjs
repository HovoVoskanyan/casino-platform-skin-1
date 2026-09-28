// P3-29 browser walk: a new player finds the laptop's Weekend Reload and Free Spins Drop under My Account → Bonuses,
// claims the reload behind the terms checkbox, deposits ₱1,000 through the stub PSP and watches the bonus turn Active
// with its wagering (and the header gain the ₱500), opens the bonuses in place from the header, claims the free rounds,
// and then meets the two P3-28 moments a bonus unlocks: the "play with your bonus?" prompt and the withdrawal forfeit
// confirm. Against the RUNNING laptop stack through the skin dev server (default http://localhost:3002), in Chrome.
// Usage: npm run e2e:bonus    (SKIN_URL=…, COMPOSE_DIR=../casino-platform-backend/deploy)
// Seeds with deploy/smoke/bonus.py + cashier.py; spends one signup of the edge mail throttle (5 per 10 minutes).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = process.env.SKIN_URL ?? "http://localhost:3002";
const COMPOSE_DIR = process.env.COMPOSE_DIR ?? "../casino-platform-backend/deploy";
const SHOTS = "e2e/shots";
const smoke = (script, ...args) => execFileSync("python3", [`${COMPOSE_DIR}/smoke/${script}`, ...args], { encoding: "utf8" }).trim();

let ok = 0;
let fail = 0;
const step = (name, passed, detail = "") => {
  if (passed) ok++;
  else fail++;
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${passed ? "" : ` ${detail}`}`);
};
const text = async (locator) => ((await locator.first().textContent({ timeout: 10_000 }).catch(() => null)) ?? "").trim();
const visible = (locator, timeout = 10_000) => locator.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);
const until = async (fn, timeout = 20_000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};
const shoot = async (page, name, fullPage = false) => {
  await page.screenshot({ path: `${SHOTS}/${name}-1280.png`, fullPage });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: `${SHOTS}/${name}-375.png`, fullPage });
  await page.setViewportSize({ width: 1280, height: 900 });
};

console.log("== the laptop's bonuses and stub-PSP methods");
console.log("  " + smoke("bonus.py", "seed"));
console.log("  " + smoke("cashier.py", "seed"));
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + "/");

console.log("== a new player, signed in by cookie");
const signup = await page.evaluate(async () => {
  const email = `p329-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = "P329-" + crypto.randomUUID().slice(0, 12) + "a1";
  const r = await fetch("/api/id/auth/signup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ageConfirmed: true, username: null, phone: null, verifyUrl: null }) });
  return r.status;
});
step("signup answered 200", signup === 200, signup);

console.log("== My Account → Bonuses: what the laptop offers");
await page.goto(BASE + "/account?tab=bonuses");
const available = page.getByRole("region", { name: "Available to claim" });
const reload = available.getByRole("article", { name: "Weekend Reload" });
step("the Weekend Reload is offered, its reward built from the definition", await visible(reload.getByText("50% deposit bonus, up to ₱1,000")));
const spinsOffer = available.getByRole("article", { name: "Free Spins Drop" });
step("the Free Spins Drop is offered, naming its game", await visible(spinsOffer.getByText(/^25 free spins on /)), await text(spinsOffer));
step("no step-award carrier is offered to this player (P3-29 finding)", (await available.getByRole("article", { name: "Deposit bonus free spins" }).count()) === 0);
await reload.getByRole("button", { name: "View terms" }).click();
step("the terms say how it is earned", await visible(reload.getByText(/Claim it here, then make a qualifying deposit/)));
await shoot(page, "p329-account-bonuses", true);

console.log("== claim: terms box first, then Confirm");
await reload.getByRole("button", { name: "Claim bonus" }).click();
const confirm = reload.getByRole("button", { name: "Confirm claim" });
step("the first press only asks for the terms", await visible(reload.getByRole("checkbox")) && await confirm.isDisabled());
await reload.getByRole("checkbox").check();
await confirm.click();
const active = page.getByRole("region", { name: "Active bonuses" });
const awaiting = active.getByRole("article", { name: "Weekend Reload" });
step("bonus opted the player in: the card is Active → Awaiting activation, with the service's answer",
  await visible(awaiting.getByText("Awaiting activation")) && (await text(awaiting.getByRole("status"))).startsWith("Claimed."), await text(awaiting));
step("…and it is no longer offered", (await available.getByRole("article", { name: "Weekend Reload" }).count()) === 0);
await shoot(page, "p329-claimed");

console.log("== a ₱1,000 GCash deposit grants it");
await page.goto(BASE + "/wallet");
const header = page.getByTestId("header-balance");
await until(async () => (await text(header)) === "₱0.00");
await page.getByRole("button", { name: "Deposit", exact: true }).first().click();
const dialog = page.getByRole("dialog", { name: "Add money to your wallet" });
await dialog.getByRole("radio", { name: /GCash/ }).click();
await dialog.getByRole("button", { name: "₱1,000" }).click();
await dialog.getByRole("button", { name: "Continue to GCash" }).click();
await visible(page.getByRole("dialog", { name: "Your GCash deposit" }).getByText("Pending"));
const paymentId = await page.evaluate(async () => (await (await fetch("/api/payments/history?type=deposit&take=1", { credentials: "include" })).json())[0]?.id);
console.log("  " + smoke("cashier.py", "complete", paymentId));
step("the header gains the deposit AND the ₱500 bonus (hub push)", await until(async () => (await text(header)) === "₱1,500.00", 30_000), await text(header));
await page.keyboard.press("Escape");

console.log("== the bonuses, in place from the header");
await page.getByRole("button", { name: "Show balance details" }).click();
await page.getByRole("button", { name: "View my bonuses" }).click();
const drawer = page.getByRole("dialog", { name: "My bonuses" });
const running = drawer.getByRole("region", { name: "Active bonuses" }).getByRole("article", { name: "Weekend Reload" });
step("the drawer shows the Weekend Reload Active", await visible(running.getByText("Active", { exact: true }), 15_000), await text(running));
step("…with ₱500 credit and its 20× wagering of ₱10,000", await visible(running.getByText("₱500.00 bonus credit")) && await visible(running.getByText(/requirement: ₱0\.00 of ₱10,000\.00/)), await text(running));
step("…and what is left of it, from the wallet", await visible(running.getByText("₱500.00 of ₱500.00 bonus credit remaining")), await text(running));
step("the bonus balance reads ₱500.00", (await text(drawer.getByTestId("bonus-balance"))) === "₱500.00", await text(drawer.getByTestId("bonus-balance")));

const spins = drawer.getByRole("region", { name: "Available to claim" }).getByRole("article", { name: "Free Spins Drop" });
await spins.getByRole("button", { name: "Claim bonus" }).click();
await spins.getByRole("checkbox").check();
await spins.getByRole("button", { name: "Confirm claim" }).click();
const held = drawer.getByRole("region", { name: "Active bonuses" }).getByRole("article", { name: "Free Spins Drop" });
const heldNow = await visible(held, 20_000);
const refusal = heldNow ? "" : await text(spins.getByRole("status"));
step("the free rounds are claimed through core and held", heldNow, refusal);
if (heldNow) step("…25 of 25 spins left", await visible(held.getByText("25 of 25 spins left")), await text(held));
await shoot(page, "p329-drawer");
await page.keyboard.press("Escape");
step("Escape closes the drawer", await until(async () => (await drawer.count()) === 0, 5_000));

console.log("== P3-28's bonus moments, now reachable");
const game = await page.evaluate(async () => (await (await fetch("/api/v1/games?pageSize=50")).json()).items.find((g) => g.hasDemo));
await page.goto(`${BASE}/games/${game.id}`);
await page.getByRole("button", { name: "Play for Real" }).click();
const prompt = page.getByRole("dialog", { name: "Play with your bonus balance?" });
step("Play for Real asks first: play with your bonus balance?", await visible(prompt, 10_000));
await page.screenshot({ path: `${SHOTS}/p329-bonus-prompt-1280.png` });
await page.keyboard.press("Escape");

const playerId = await page.evaluate(async () => (await (await fetch("/api/id/auth/account", { credentials: "include" })).json()).playerId);
console.log("  " + smoke("cashier.py", "play", playerId, "100000", "60000")); // a real-money round: deposit turnover met
await page.goto(BASE + "/wallet");
await page.getByRole("button", { name: "Withdraw", exact: true }).click();
const withdraw = page.getByRole("dialog", { name: "Withdraw to your e-wallet" });
await withdraw.getByLabel("Amount").fill("200");
await withdraw.getByLabel(/number/).fill("0917 123 4567");
await withdraw.getByRole("button", { name: "Review withdrawal" }).click();
const review = page.getByRole("dialog", { name: "Review your withdrawal" });
const ack = review.getByRole("checkbox", { name: /forfeits my bonus funds of ₱500\.00/ });
step("the withdrawal asks the player to acknowledge forfeiting ₱500.00 of bonus", await visible(ack), await text(review));
step("…and Confirm waits for it", await review.getByRole("button", { name: "Confirm withdrawal" }).isDisabled());
await ack.check();
step("…ticked, Confirm is live", await review.getByRole("button", { name: "Confirm withdrawal" }).isEnabled());
await shoot(page, "p329-forfeit-confirm");

await browser.close();
console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
