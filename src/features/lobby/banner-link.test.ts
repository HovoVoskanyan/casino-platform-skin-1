import { describe, expect, it } from "vitest";
import { EXTERNAL_MAX, isExternalLink, isSiteLink, LINK_MAX } from "./banner-link";

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

/** The same examples as core's ExternalLinkRules tests: the skin renders a new-tab link only for these. */
describe("isExternalLink mirrors core's ExternalLinkRules", () => {
  it.each(["https://partner.example/offer", "  https://Partner.Example  ", "HTTPS://partner.example/a?b=1#c", "https://www.partner.example:8443/x", "https://bücher.example/"])(
    "accepts %j", (raw) => expect(isExternalLink(raw)).toBe(true));

  it.each([null, "", "http://partner.example", "javascript:alert(1)", "data:text/html,hi", "ftp://partner.example", "partner.example", "https://",
    "https://user:pw@partner.example", "https://partner.example@evil.example", "https://127.0.0.1/", "https://[::1]/", "https://0x7f.1/", "https://localhost/",
    "https://app.localhost/", "https://intranet/", "https://partner.example\\@evil.example", "https://partner.example/a b", "https://partner.\texample", "/games"])(
    "refuses %j", (raw) => expect(isExternalLink(raw)).toBe(false));

  it("caps the length", () => {
    const head = "https://partner.example/";
    expect(isExternalLink(head + "a".repeat(EXTERNAL_MAX - head.length))).toBe(true);
    expect(isExternalLink(head + "a".repeat(EXTERNAL_MAX - head.length + 1))).toBe(false);
  });
});
