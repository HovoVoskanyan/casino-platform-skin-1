import { gamePath, gameSlug, SLUG_MAX } from "./slug";

// The same examples sit in core's SeoTests (Platform.Core.Api.Tests) — the sitemap and the page must agree.
it.each([
  ["Sweet Bonanza", "sweet-bonanza"],
  ["  Gates of Olympus 1000 ", "gates-of-olympus-1000"],
  ["Pokémon: Crème Brûlée!", "pokemon-creme-brulee"],
  ["Big Bass -- Splash", "big-bass-splash"],
  ["777 Strike", "777-strike"],
  ["Ünïcödé ß Straße", "unicode-ss-strasse"],
  ["龙虎", "game"],
  ["", "game"],
  ["!!!", "game"],
])("slugs %j as %j", (name, slug) => {
  expect(gameSlug(name)).toBe(slug);
});

it("cuts a long name at a word, under the limit", () => {
  const slug = gameSlug(Array(20).fill("fortune").join(" "));
  expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
  expect(slug.endsWith("fortune")).toBe(true);
});

it("builds the canonical game path", () => {
  expect(gamePath({ id: "0f1e", name: "Sweet Bonanza" })).toBe("/games/0f1e/sweet-bonanza");
});
