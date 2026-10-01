// P3-31 browser walk: the Support panel against chat on the RUNNING laptop stack, through the skin dev server (default
// http://localhost:3002; SKIN_URL=http://localhost:3003 for the skin container), in Chrome. A guest meets "sign in to
// chat"; a new player opens Support from Help, sees the greeting, writes a line (it shows at once and chat keeps it
// exactly once), taps a canned question when the laptop has any (its answer comes back as a ChoCho line), and Escape
// hands focus back to Help. The hub connects through the gateway with the cookie. Agent replies need an admin — the
// backend's deploy/smoke/chat.py proves that path.
// Usage: npm run e2e:support    (SKIN_URL=…) — spends one signup of the edge mail throttle (5 per 10 minutes).
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
const text = async (locator) => ((await locator.first().textContent({ timeout: 10_000 }).catch(() => null)) ?? "").trim();
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

console.log("== a guest: sign in to chat, the FAQ one tap away");
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/vip");
  await page.getByRole("button", { name: /Support/ }).last().click(); // the footer entry
  const panel = page.getByRole("dialog", { name: "Chat with ChoCho" });
  step("the footer Support opens the panel", await visible(panel));
  step("…asking a guest to sign in, with no composer", await visible(panel.getByText("Sign in to chat with us")) && (await panel.getByRole("textbox").count()) === 0);
  step("…and the FAQ link", (await panel.getByRole("link", { name: "Read the FAQ" }).getAttribute("href")) === "/info/faq");
  await page.screenshot({ path: `${SHOTS}/p331-guest-1280.png` });
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const net = [];
page.on("response", (r) => {
  if (r.url().includes("/api/v1/hubs/support") || r.url().includes("/api/v1/support/")) net.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`);
});
await page.goto(BASE + "/");

console.log("== a new player, signed in by cookie");
const signup = await page.evaluate(async () => {
  const email = `p331-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = "P331-" + crypto.randomUUID().slice(0, 12) + "a1";
  const r = await fetch("/api/id/auth/signup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ageConfirmed: true, username: null, phone: null, verifyUrl: null }) });
  return r.status;
});
step("signup answered 200", signup === 200, signup);
await page.goto(BASE + "/vip");
step("the support hub connects through the gateway with the cookie",
  await until(async () => net.some((l) => /POST \/api\/v1\/hubs\/support\/negotiate 200/.test(l))), net.join("; "));

console.log("== Help opens the panel");
const help = page.getByRole("button", { name: /^Help/ }).first();
await help.click();
const panel = page.getByRole("dialog", { name: "Chat with ChoCho" });
step("the panel opens: Chat with ChoCho · Live support", await visible(panel) && await visible(panel.getByText("Live support")));
const log = panel.getByRole("log", { name: "Messages" });
step("a new player is greeted", await visible(log.getByText(/how can I help you today/)), await text(log));

console.log("== write a line");
const mine = `Hello from the e2e ${Date.now().toString(36)} — line one\nline two`;
await panel.getByRole("textbox", { name: "Message" }).fill(mine);
await panel.getByRole("button", { name: "Send" }).click();
const bubble = log.getByText(/Hello from the e2e .* line one/);
step("the line shows at once", await visible(bubble, 3_000));
step("…and chat confirms it (no Sending…, no error)", await until(async () => (await log.getByText("Sending…").count()) === 0, 10_000) && (await panel.getByRole("alert").count()) === 0, await text(log));
step("…with its line break kept", (await bubble.first().textContent())?.includes("line one\nline two"), await bubble.first().textContent());
const stored = await page.evaluate(async () => (await (await fetch("/api/v1/support/conversation", { credentials: "include" })).json()));
step("chat holds the line exactly once", stored.messages.filter((m) => m.author === "player" && m.body.includes("Hello from the e2e")).length === 1, JSON.stringify(stored).slice(0, 300));
step("…in an open conversation", stored.conversation?.status === "open", JSON.stringify(stored.conversation));
await page.waitForTimeout(1_000); // the hub's echo of the same line has landed by now
step("the hub's echo does not double it on screen", (await log.getByText(/Hello from the e2e .* line one/).count()) === 1);

console.log("== canned questions");
const chips = panel.getByRole("group", { name: "Quick questions" });
if (await visible(chips, 3_000)) {
  const chip = chips.getByRole("button").first();
  const question = await text(chip);
  const before = await log.getByText("ChoCho", { exact: true }).count();
  await chip.click();
  step(`tapping "${question}" answers as a ChoCho line`, await until(async () => (await log.getByText("ChoCho", { exact: true }).count()) > before, 10_000), await text(log));
} else {
  console.log("  SKIP  the laptop has no canned questions for this skin (chat.py removes its own)");
}
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/p331-panel-1280.png` });

console.log("== Escape closes, focus returns to Help");
await page.keyboard.press("Escape");
step("Escape closes the panel", await until(async () => (await panel.count()) === 0, 5_000));
step("…and focus is back on Help", await help.evaluate((el) => el === document.activeElement));

console.log("== phones: a full-screen sheet");
await page.setViewportSize({ width: 375, height: 812 });
await page.getByRole("button", { name: /^Support|24\/7 Support/ }).last().click();
await panel.waitFor({ state: "visible" });
await page.waitForTimeout(400); // the sheet's rise animation
const box = await panel.boundingBox();
step("the panel fills the screen", box && box.width >= 370 && box.height >= 800, JSON.stringify(box));
step("…with the thread", await visible(log.getByText(/Hello from the e2e .* line one/)));
await page.screenshot({ path: `${SHOTS}/p331-panel-375.png` });

await browser.close();
console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
