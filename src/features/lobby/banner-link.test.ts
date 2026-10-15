import { describe, expect, it } from "vitest";
import { isSiteLink, LINK_MAX } from "./banner-link";

/** The same examples as core's BannerLinkTests and the back office's copy: the skin renders a link only for these. */
describe("isSiteLink mirrors core's SiteLinkRules", () => {
  it.each(["/", "/games", "  /promotions ", "/games?category=slots", "/wallet#deposit", "/info/terms%20and%20conditions", "/games?redirect=https://ok.example"])(
    "accepts %j", (path) => expect(isSiteLink(path)).toBe(true));

  it.each([null, undefined, "", "   ", "https://evil.example", "//evil.example", "/\\evil.example", "\\\\evil.example", "javascript:alert(1)", "data:text/html,hi",
    "games", "./games", "?category=slots", "/%2F%2Fevil.example", "/%2fevil.example", "/%5Cevil.example", "/%09/evil.example", "/\t/evil.example", "/ga\nmes", "/ga mes"])(
    "refuses %j", (path) => expect(isSiteLink(path)).toBe(false));

  it("caps the length", () => {
    expect(isSiteLink("/" + "a".repeat(LINK_MAX - 1))).toBe(true);
    expect(isSiteLink("/" + "a".repeat(LINK_MAX))).toBe(false);
  });
});
