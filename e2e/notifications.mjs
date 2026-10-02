// P3-30 browser walk: the notifications bell and drawer against `notifications` on the RUNNING laptop stack, through
// the skin dev server (default http://localhost:3002; SKIN_URL=http://localhost:3003 for the skin container), in
// Chrome. A guest has no bell; a new player has the bell, its hub connects through the gateway with the cookie, the
// drawer opens on the inbox (empty for a brand-new player, or whatever the laptop has published to everyone), and
// Escape hands focus back to the bell. Publishing a notice needs an admin — the backend's smoke proves that path.
// Usage: npm run e2e:notifications    (SKIN_URL=…) — spends one signup of the edge mail throttle (5 per 10 minutes).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SKIN_URL ?? "http://localhost:3002";
const SHOTS = "e2e/shots";

let ok = 0;
let fail = 0;
const step = (name, passed, detail = "") => {
  if (passed) ok++;
  else fail++;
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${passed ? "" : ` ${detail}`}`);
};
const visible = (locator, timeout = 10_000) => locator.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);
const until = async (fn, timeout = 20_000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });

console.log("== a guest: no bell");
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/vip");
  await page.getByRole("button", { name: "Sign in" }).first().waitFor();
  step("no notifications bell for a guest", (await page.getByRole("button", { name: /^Notifications/ }).count()) === 0);
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const net = [];
page.on("response", (r) => {
  if (r.url().includes("/api/v1/hubs/notifications") || r.url().includes("/api/v1/notifications")) net.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`);
});
await page.goto(BASE + "/");

console.log("== a new player, signed in by cookie");
const signup = await page.evaluate(async () => {
  const email = `p330-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = "P330-" + crypto.randomUUID().slice(0, 12) + "a1";
  const r = await fetch("/api/id/auth/signup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ageConfirmed: true, username: null, phone: null, verifyUrl: null }) });
  return r.status;
});
step("signup answered 200", signup === 200, signup);
await page.goto(BASE + "/vip");
const bell = page.getByRole("button", { name: /^Notifications/ }).first();
step("the bell is in the header", await visible(bell));
step("the count is read through the gateway", await until(async () => net.some((l) => /GET \/api\/v1\/notifications\/unread-count 200/.test(l))), net.join("; "));
step("the notifications hub connects through the gateway with the cookie",
  await until(async () => net.some((l) => /POST \/api\/v1\/hubs\/notifications\/negotiate 200/.test(l))), net.join("; "));

console.log("== the bell opens the drawer");
await bell.click();
const drawer = page.getByRole("dialog", { name: "Notifications" });
step("the drawer opens", await visible(drawer));
step("…on the inbox (a notice, or the empty state)",
  await until(async () => (await drawer.getByTestId("notice").count()) > 0 || (await drawer.getByText("No notifications yet").count()) > 0, 10_000));
const shown = await drawer.getByTestId("notice").count();
console.log(`  INFO  ${shown} notice(s) shown`);
if (shown > 0) {
  step("…and opening it marked them read", await until(async () => net.some((l) => /POST \/api\/v1\/notifications\/read-all 200/.test(l)), 5_000), net.join("; "));
}
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/p330-drawer-1280.png` });

console.log("== Escape closes, focus returns to the bell");
await page.keyboard.press("Escape");
step("Escape closes the drawer", await until(async () => (await drawer.count()) === 0, 5_000));
step("…and focus is back on the bell", await bell.evaluate((el) => el === document.activeElement));
step("…with no unread badge left", (await page.getByTestId("notifications-unread").count()) === 0);

await browser.close();
console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
