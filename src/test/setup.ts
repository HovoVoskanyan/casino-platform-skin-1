import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";
import i18n, { applySiteLanguages } from "@/i18n";
import { setSkinCurrency } from "@/lib/money";
import { fakeHub, fakeNotificationsHub, fakeSupportHub, installFakeHub } from "./fake-hub";
import { notificationsDrawer } from "@/features/notifications/notifications-drawer";
import { supportPanel, supportStore } from "@/features/support/support-store";
import { balanceStore } from "@/features/wallet/balance-store";

installFakeHub();

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  await i18n.loadLanguages("en-PH");
});
afterEach(() => {
  server.resetHandlers();
  fakeHub.reset();
  fakeSupportHub.reset();
  fakeNotificationsHub.reset();
  notificationsDrawer.close();
  supportPanel.close();
  supportStore.reset();
  balanceStore.set({ status: "unknown" });
  localStorage.clear();
  // a test that switched the site's language or currency leaves the next one on the defaults
  setSkinCurrency("PHP");
  applySiteLanguages(["en-ph", "fil"], "en-ph");
  void i18n.changeLanguage("en-PH");
});
afterAll(() => server.close());

if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: "", onchange: null }) as unknown as MediaQueryList;
}
