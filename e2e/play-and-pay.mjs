// P3-28 browser walk: a new player sees their live balance, deposits with GCash through the stub PSP, watches the
// deposit complete and the header move without a reload, opens a game in demo and real mode, and asks for a
// withdrawal the turnover gate refuses in payments' own words — then, after a round is booked, one that lands Pending. Against the RUNNING laptop stack through the skin dev
// server (default http://localhost:3002, host = skin-test), in the installed Chrome.
// Usage: npm run e2e:play    (SKIN_URL=…, COMPOSE_DIR=../casino-platform-backend/deploy)
// Seeds skin-test's stub methods with deploy/smoke/cashier.py and plays the PSP with `cashier.py complete`.
// Spends one signup of the edge mail throttle (5 per 10 minutes). Screenshots land in e2e/shots/ (git-ignored).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = process.env.SKIN_URL ?? "http://localhost:3002";
const COMPOSE_DIR = process.env.COMPOSE_DIR ?? "../casino-platform-backend/deploy";
const SHOTS = "e2e/shots";
const cashier = (...args) => execFileSync("python3", [`${COMPOSE_DIR}/smoke/cashier.py`, ...args], { encoding: "utf8" }).trim();

let ok = 0;
let fail = 0;
const step = (name, passed, detail = "") => {
  if (passed) ok++;
  else fail++;
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${passed ? "" : ` ${detail}`}`);
};
const text = async (locator) => ((await locator.textContent({ timeout: 10_000 }).catch(() => null)) ?? "").trim();
// locator.isVisible() answers NOW (it ignores its timeout) — every check that expects something to appear waits for it.
const visible = (locator, timeout = 10_000) => locator.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);
const until = async (fn, timeout = 20_000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

console.log("== the laptop's stub-PSP methods");
console.log("  " + cashier("seed"));
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + "/");

console.log("== a new player, signed in by cookie");
const signup = await page.evaluate(async () => {
  const email = `p328-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = "P328-" + crypto.randomUUID().slice(0, 12) + "a1";
  const r = await fetch("/api/id/auth/signup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ageConfirmed: true, username: null, phone: null, verifyUrl: null }) });
  return r.status;
});
step("signup answered 200", signup === 200, signup);

await page.goto(BASE + "/wallet");
const header = page.getByTestId("header-balance");
step("the header's balance is live from core's hub (a new player holds ₱0.00)", await until(async () => (await text(header)) === "₱0.00"), await text(header));

console.log("== a GCash deposit, completed by the (stub) PSP");
await page.getByRole("button", { name: "Show balance details" }).click();
step("the balance details panel opens", await visible(page.getByRole("dialog", { name: "Balance details" })));
await page.screenshot({ path: `${SHOTS}/p328-balance-panel-1280.png` });
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Deposit", exact: true }).first().click();
const dialog = page.getByRole("dialog", { name: "Add money to your wallet" });
await dialog.getByRole("radio", { name: /GCash/ }).click();
await dialog.getByRole("button", { name: "₱1,000" }).click();
await page.setViewportSize({ width: 375, height: 812 });
await page.screenshot({ path: `${SHOTS}/p328-deposit-375.png` });
await page.setViewportSize({ width: 1280, height: 900 });
await dialog.getByRole("button", { name: "Continue to GCash" }).click();
const progress = page.getByRole("dialog", { name: "Your GCash deposit" });
const created = await visible(progress.getByText("Pending"), 10_000);
if (!created) await page.screenshot({ path: `${SHOTS}/p328-deposit-failed.png` });
step("the deposit is created and waits on GCash", created);
const paymentId = await page.evaluate(async () => (await (await fetch("/api/payments/history?type=deposit&take=1", { credentials: "include" })).json())[0]?.id);
step("payments has the deposit in the player's history", !!paymentId, paymentId);
console.log("  " + cashier("complete", paymentId));
step("the dialog follows it to Completed without a reload", await visible(progress.getByText("₱1,000.00 has been added to your wallet."), 15_000));
step("…and the header moved with the wallet (hub push)", await until(async () => (await text(header)) === "₱1,000.00"), await text(header));
await progress.getByRole("button", { name: "Close" }).last().click(); // the footer button (the ✕ is named Close too)
step("the deposit is in Recent transactions, Completed", await visible(page.getByRole("list").getByText("Completed"), 10_000));
await page.screenshot({ path: `${SHOTS}/p328-wallet-1280.png`, fullPage: true });
await page.setViewportSize({ width: 375, height: 812 });
await page.screenshot({ path: `${SHOTS}/p328-wallet-375.png`, fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });

console.log("== a withdrawal before the deposit is wagered: the quote refuses it, in payments' words");
await page.getByRole("button", { name: "Withdraw", exact: true }).click();
const withdraw = page.getByRole("dialog", { name: "Withdraw to your e-wallet" });
await withdraw.getByLabel("Amount").fill("200");
await withdraw.getByLabel(/number/).fill("9171234567");
await withdraw.getByRole("button", { name: "Review withdrawal" }).click();
const review = page.getByRole("dialog", { name: "Review your withdrawal" });
step("the server's forfeit notice is shown", (await text(review.getByRole("note"))).length > 20, await text(review.getByRole("note")));
step("the turnover refusal is shown and nothing can be confirmed",
  (await visible(review.getByText(/wagering requirement/), 5_000)) && (await review.getByRole("button", { name: "Confirm withdrawal" }).count()) === 0);
await page.keyboard.press("Escape");

console.log("== after a round is played, the withdrawal goes through: Pending, with the money held");
const playerId = await page.evaluate(async () => (await (await fetch("/api/id/auth/account", { credentials: "include" })).json()).playerId);
console.log("  " + cashier("play", playerId, "100000", "60000"));
step("the header follows the round (hub push)", await until(async () => (await text(header)) === "₱600.00"), await text(header));
await page.getByRole("button", { name: "Withdraw", exact: true }).click();
const again = page.getByRole("dialog", { name: "Withdraw to your e-wallet" });
await again.getByLabel("Amount").fill("200");
await again.getByLabel(/number/).fill("0917 123 4567"); // written the way the wallets print it
await again.getByRole("button", { name: "Review withdrawal" }).click();
const allowed = page.getByRole("dialog", { name: "Review your withdrawal" });
step("the quote allows it now, still with the server's notice", await visible(allowed.getByRole("button", { name: "Confirm withdrawal" })) && (await text(allowed.getByRole("note"))).length > 20);
await page.setViewportSize({ width: 375, height: 812 });
await page.screenshot({ path: `${SHOTS}/p328-withdraw-review-375.png` });
await page.setViewportSize({ width: 1280, height: 900 });
await allowed.getByRole("button", { name: "Confirm withdrawal" }).click();
const requested = page.getByRole("dialog", { name: "Withdrawal requested" });
step("the withdrawal lands Pending", await visible(requested.getByText("Pending")));
step("…and the held ₱200 leaves the header total", await until(async () => (await text(header)) === "₱400.00"), await text(header));
await requested.getByRole("button", { name: "Close" }).last().click();
step("the withdrawal is in Recent transactions, Pending", await visible(page.getByRole("list").getByText("Pending")));

console.log("== a game, in demo and real mode");
const game = await page.evaluate(async () => (await (await fetch("/api/v1/games?pageSize=50")).json()).items.find((g) => g.hasDemo));
if (!game) throw new Error("no game with a demo on this skin — curate one (core admin) before running the walk");
await page.goto(`${BASE}/games/${game.id}`);
await page.getByRole("button", { name: "Play for Fun" }).click();
const frame = page.getByTestId("game-frame");
step("demo opens the provider's fragment in the sandboxed container", await visible(frame, 10_000));
step("…without the skin's origin (no allow-same-origin)", !((await frame.getAttribute("sandbox")) ?? "").includes("allow-same-origin"));
await page.screenshot({ path: `${SHOTS}/p328-game-demo-1280.png` });
await page.getByRole("button", { name: "Close game" }).click();
await page.getByRole("button", { name: "Play for Real" }).click();
const eligible = await visible(page.getByRole("dialog", { name: "Play with your bonus balance?" }), 2_000);
if (eligible) await page.getByRole("button", { name: "Play with cash balance" }).click();
step("real money opens the game from the player's peso account", await visible(frame, 10_000));
step("…labelled Real money", (await text(page.getByRole("dialog", { name: /^Playing / }))).includes("Real money"));
await page.setViewportSize({ width: 375, height: 812 });
await page.screenshot({ path: `${SHOTS}/p328-game-real-375.png` });

await browser.close();
console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
