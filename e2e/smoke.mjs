// Browser smoke against a RUNNING laptop stack + the dev server, in the installed Chrome (no browser download).
// Usage: npm run e2e [-- <scenario>]   Scenarios: signup, verify, sessions, logout-login, reuse-kill, all.
// The verify step reads the confirmation link the way the mail pipeline would see it — from identity's staged
// comms.requests outbox row — through the compose stack's Postgres, so no mail provider is needed.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const BASE = process.env.SKIN_URL ?? "http://localhost:3002";
const COMPOSE_DIR = process.env.COMPOSE_DIR ?? "../casino-platform-backend/deploy";
const password = "Passw0rd!2345";
const email = `p316-${Date.now().toString(36)}@example.test`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const log = [];
page.on("console", (m) => { if (m.type() === "error") log.push(`[console.error] ${m.text().slice(0, 300)}`); });
page.on("pageerror", (e) => log.push(`[pageerror] ${e.message.slice(0, 300)}`));
page.on("response", (r) => { const u = r.url(); if (u.includes("/api/")) log.push(`[net] ${r.request().method()} ${u.replace(BASE, "")} → ${r.status()}`); });

const toasts = async () => (await page.locator("[data-sonner-toast]").allTextContents()).map((t) => t.trim());

function verificationLink(address) {
  // identity stages `comms.requests` rows in its outbox; the payload carries variables.verificationLink.
  const sql = `select payload_json from outbox_events where topic='comms.requests' and payload_json::text like '%${address}%' order by created_at desc limit 1;`;
  const out = execFileSync("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", `psql -U "$POSTGRES_USER" -d identity -Atc "${sql.replace(/"/g, '\\"')}"`], { cwd: COMPOSE_DIR, encoding: "utf8" }).trim();
  const payload = JSON.parse(out);
  const link = payload.variables?.verificationLink ?? payload.Variables?.verificationLink;
  if (!link) throw new Error("no verificationLink in the staged comms row: " + out.slice(0, 200));
  return link;
}

async function signup() {
  await ctx.clearCookies();
  await page.goto(BASE + "/#register");
  await page.getByRole("tab", { name: "Email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("link", { name: "My Account" }).waitFor({ timeout: 10000 });
}
async function signin() {
  await page.goto(BASE + "/#signin");
  await page.getByRole("tab", { name: "Email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.getByRole("link", { name: "My Account" }).waitFor({ timeout: 10000 });
}

const scenario = process.argv[2] ?? "all";
try {
  if (["signup", "all"].includes(scenario)) {
    await signup();
    console.log("SIGNUP OK →", email, "toasts:", await toasts());
  }
  if (["verify", "all"].includes(scenario)) {
    const link = verificationLink(email);
    const url = new URL(link);
    await page.goto(BASE + url.pathname + url.search);
    await page.getByText("Your email is confirmed").waitFor({ timeout: 10000 });
    console.log("VERIFY OK →", url.pathname);
  }
  if (["sessions", "all"].includes(scenario)) {
    await page.goto(BASE + "/account");
    await page.getByRole("tab", { name: "Sessions" }).click();
    await page.getByText("This device").waitFor({ timeout: 10000 });
    console.log("SESSIONS OK → this device listed");
  }
  if (["logout-login", "all"].includes(scenario)) {
    await page.getByRole("button", { name: "Sign out", exact: true }).first().click();
    await page.getByRole("button", { name: "Register" }).first().waitFor({ timeout: 10000 });
    await signin();
    console.log("LOGOUT+LOGIN OK");
  }
  if (["reuse-kill", "all"].includes(scenario)) {
    // Sign out everywhere, then the old cookies must be dead: a protected page shows the gate, not data.
    const cookies = await ctx.cookies();
    await page.goto(BASE + "/account");
    await page.getByRole("tab", { name: "Sessions" }).click();
    await page.getByRole("button", { name: "Sign out everywhere" }).click();
    await page.getByRole("button", { name: "Register" }).first().waitFor({ timeout: 10000 });
    await ctx.addCookies(cookies);
    await page.goto(BASE + "/account");
    await page.getByText("Sign in to view My Account").waitFor({ timeout: 10000 });
    console.log("REUSE-KILL OK → old cookies do not revive the session");
  }
  await page.screenshot({ path: "shot-app.png" });
  console.log("DONE");
} catch (e) {
  await page.screenshot({ path: "shot-fail.png" }).catch(() => {});
  console.error("FAILED:", e.message);
  console.error(log.slice(-25).join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
