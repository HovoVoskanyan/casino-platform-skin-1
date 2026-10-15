import { seoCategory } from "./game-seo";

const categories = [{ code: "popular", name: "Popular" }, { code: "new", name: "New" }, { code: "slots", name: "Slots" }, { code: "live", name: "Live Casino" }];

it("names the kind of game, not the curated list it sits in", () => {
  expect(seoCategory(categories, ["popular", "new", "slots"])).toBe("Slots");
});

it("falls back to a curated list when that is all the game is in, and to nothing when it is in none", () => {
  expect(seoCategory(categories, ["popular"])).toBe("Popular");
  expect(seoCategory(categories, [])).toBeUndefined();
});
