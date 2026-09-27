import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";
import i18n from "@/i18n";
import { fakeHub, installFakeHub } from "./fake-hub";
import { balanceStore } from "@/features/wallet/balance-store";

installFakeHub();

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  await i18n.loadLanguages("en-PH");
});
afterEach(() => {
  server.resetHandlers();
  fakeHub.reset();
  balanceStore.set({ status: "unknown" });
  localStorage.clear();
});
afterAll(() => server.close());

if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: "", onchange: null }) as unknown as MediaQueryList;
}
