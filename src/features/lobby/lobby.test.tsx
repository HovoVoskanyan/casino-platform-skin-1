import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { problem, server, signedIn } from "@/test/server";
import { catalogue, game, PROMOTIONS } from "@/test/lobby-fixtures";
import { authDialog } from "@/features/auth/auth-dialog-state";

afterEach(() => authDialog.close());

describe("Games (P3-27)", () => {
  it("renders core's catalogue twelve at a time and Load More asks for the next page", async () => {
    const user = userEvent.setup();
    const seen: URL[] = [];
    const languages: (string | null)[] = [];
    server.use(...catalogue(30, seen, languages));
    renderRoute("/games");

    const grid = await screen.findByRole("region", { name: /All Games/ });
    await waitFor(() => expect(within(grid).getAllByRole("link", { name: /Pragmatic Play/ })).toHaveLength(12));
    expect(within(grid).getByText("30 games")).toBeInTheDocument();

    await user.click(within(grid).getByRole("button", { name: "Load More (12 of 30)" }));
    await waitFor(() => expect(within(grid).getAllByRole("link", { name: /Pragmatic Play/ })).toHaveLength(24));
    expect(seen.some((u) => u.searchParams.get("page") === "2" && u.searchParams.get("pageSize") === "12")).toBe(true);
    expect(languages.every((l) => l === "en-PH")).toBe(true); // the UI language, not the browser's
  });

  it("a filter from the URL reaches core as-is, and a pill changes it", async () => {
    const user = userEvent.setup();
    const seen: URL[] = [];
    server.use(...catalogue(3, seen));
    const { router } = renderRoute("/games?category=slots&sort=name");

    await screen.findByRole("region", { name: /All Games/ });
    await waitFor(() => expect(seen.some((u) => u.searchParams.get("category") === "slots" && u.searchParams.get("sort") === "name")).toBe(true));

    await user.click(await screen.findByRole("button", { name: "New" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ badge: "new", sort: "name" }));
    await waitFor(() => expect(seen.at(-1)!.searchParams.get("badge")).toBe("new"));
  });

  it("an unknown filter value is dropped, never sent", async () => {
    const seen: URL[] = [];
    server.use(...catalogue(1, seen));
    renderRoute("/games?sort=random&category=Not%20A%20Slug");
    await screen.findByRole("region", { name: /All Games/ });
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.every((u) => !u.searchParams.has("category") && u.searchParams.get("sort") !== "random")).toBe(true);
  });

  it("the HOT and NEW ribbons come from the card's badges", async () => {
    server.use(...catalogue(2));
    renderRoute("/games");
    const grid = await screen.findByRole("region", { name: /All Games/ });
    const first = await within(grid).findByRole("link", { name: "Game 1, Pragmatic Play" });
    expect(within(first).getByText("HOT")).toBeInTheDocument(); // hot wins the one ribbon slot
    expect(within(within(grid).getByRole("link", { name: "Game 2, Pragmatic Play" })).queryByText(/HOT|NEW/)).toBeNull();
  });

  it("a hand-typed numeric search stays a search", async () => {
    const seen: URL[] = [];
    server.use(...catalogue(1, seen));
    renderRoute("/games?q=777");
    await waitFor(() => expect(seen.some((u) => u.searchParams.get("q") === "777")).toBe(true));
    expect(screen.getByRole("searchbox")).toHaveValue("777");
  });

  it("Home's Hot Games link lands on a visible HOT filter", async () => {
    server.use(...catalogue(2));
    renderRoute("/games?badge=hot");
    expect(await screen.findByRole("region", { name: /Hot Games/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hot" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All Games" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("the ♥ (P3-27)", () => {
  it("a guest's tap opens sign-in instead of calling core", async () => {
    const user = userEvent.setup();
    const put = vi.fn();
    server.use(...catalogue(1), http.put("*/api/v1/me/favourites/:id", () => { put(); return new HttpResponse(null, { status: 204 }); }));
    renderRoute("/games");

    await user.click(await screen.findByRole("button", { name: "Add Game 1 to favourites" }));
    expect(authDialog.get().mode).toBe("signin");
    expect(put).not.toHaveBeenCalled();
  });

  it("a player's tap flips at once, core is told, and the rail shows it", async () => {
    const user = userEvent.setup();
    let favourites: ReturnType<typeof game>[] = [];
    const puts: string[] = [];
    server.use(
      signedIn(),
      ...catalogue(1),
      http.get("*/api/v1/me/favourites", () => HttpResponse.json(favourites)),
      http.put("*/api/v1/me/favourites/:id", ({ params }) => { puts.push(String(params.id)); favourites = [game(1)]; return new HttpResponse(null, { status: 204 }); }),
    );
    renderRoute("/games");

    const heart = (await screen.findAllByRole("button", { name: "Add Game 1 to favourites" }))[0]!;
    await user.click(heart);
    await waitFor(() => expect(puts).toEqual([game(1).id]));
    expect((await screen.findAllByRole("button", { name: "Remove Game 1 from favourites" })).length).toBeGreaterThan(0);
    expect(await screen.findByRole("region", { name: "Favourite Games" })).toBeInTheDocument();
  });

  it("a refused ♥ rolls back", async () => {
    const user = userEvent.setup();
    server.use(signedIn(), ...catalogue(1), http.get("*/api/v1/me/favourites", () => HttpResponse.json([])), http.put("*/api/v1/me/favourites/:id", () => problem(404, "NOT_FOUND")));
    renderRoute("/games");

    // the same game sits in the Popular rail and the grid: every heart for it flips back
    await user.click((await screen.findAllByRole("button", { name: "Add Game 1 to favourites" }))[0]!);
    await waitFor(() => {
      const hearts = screen.getAllByRole("button", { name: /Game 1 (to|from) favourites/ });
      expect(hearts.every((h) => h.getAttribute("aria-pressed") === "false")).toBe(true);
    });
  });

  it("the ♥ sits beside the card's link, never inside it", async () => {
    server.use(...catalogue(1));
    renderRoute("/games");
    const grid = await screen.findByRole("region", { name: /All Games/ });
    const card = await within(grid).findByRole("link", { name: "Game 1, Pragmatic Play" });
    expect(within(card).queryByRole("button")).toBeNull();
    expect(within(grid).getByRole("button", { name: "Add Game 1 to favourites" })).toBeInTheDocument();
  });

  it("a full ♥ list flips back and says why", async () => {
    const user = userEvent.setup();
    server.use(signedIn(), ...catalogue(1), http.get("*/api/v1/me/favourites", () => HttpResponse.json([])), http.put("*/api/v1/me/favourites/:id", () => problem(409, "CONFLICT")));
    renderRoute("/games");
    await user.click((await screen.findAllByRole("button", { name: "Add Game 1 to favourites" }))[0]!);
    expect(await screen.findByText("You can keep up to 200 favourites. Remove one to add another.")).toBeInTheDocument();
  });
});

describe("game detail (P3-27)", () => {
  it("a game the skin does not show reads as unavailable", async () => {
    server.use(...catalogue(1), http.get("*/api/v1/games/:id", () => problem(404, "NOT_FOUND")));
    renderRoute(`/games/${game(9).id}`);
    expect(await screen.findByRole("heading", { name: "This game is unavailable" })).toBeInTheDocument();
  });

  it("shows the game with its category and about copy, and its play modes", async () => {
    server.use(...catalogue(1), http.get("*/api/v1/games/:id", () => HttpResponse.json({ ...game(1), logoUrl: null, description: "Candy and fruit.", rtp: 96.5, volatility: "High" })));
    renderRoute(`/games/${game(1).id}`);
    expect(await screen.findByRole("heading", { name: "Game 1" })).toBeInTheDocument();
    expect(await screen.findByText("Slots")).toBeInTheDocument();
    expect(screen.getByText("Candy and fruit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play for Real" })).toBeEnabled(); // P3-28: launch is live
  });
});

describe("Promotions (P3-27)", () => {
  it("pills are the live promotions' own categories, and one filters the list", async () => {
    const user = userEvent.setup();
    server.use(...catalogue(0));
    renderRoute("/promotions");

    const pills = await screen.findByRole("navigation", { name: "Promotion categories" });
    expect(within(pills).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "WELCOME BONUS", "RELOAD"]);
    await user.click(within(pills).getByRole("button", { name: "RELOAD" }));
    const all = screen.getByRole("region", { name: /All Promotions/ });
    await waitFor(() => expect(within(all).getAllByRole("article")).toHaveLength(1));
    expect(within(all).getByText("Reload Bonus")).toBeInTheDocument();
  });

  it("?promo= opens the terms, and an ended offer says so", async () => {
    server.use(...catalogue(0));
    renderRoute(`/promotions?promo=${PROMOTIONS[1]!.id}`);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/wager 30x within 7 days/)).toBeInTheDocument();
  });

  it("an ended offer's link says it has ended", async () => {
    server.use(...catalogue(0));
    renderRoute("/promotions?promo=99999999-9999-7999-8999-999999999999");
    expect(await within(await screen.findByRole("dialog")).findByText("This offer has ended or is no longer available.")).toBeInTheDocument();
  });

  it("closing terms opened on the page steps Back — no dead history entry", async () => {
    const user = userEvent.setup();
    server.use(...catalogue(0));
    const { router } = renderRoute("/promotions");
    const start = router.state.location.state.__TSR_index;
    const all = await screen.findByRole("region", { name: /All Promotions/ });
    await user.click((await within(all).findAllByRole("link", { name: /View Details/ }))[0]!);
    await user.click(await within(await screen.findByRole("dialog")).findByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.state.__TSR_index).toBe(start);
    expect(router.state.location.search).toEqual({});
  });
});

describe("Home (P3-27)", () => {
  it("builds every section from core, and leaves out the hero when no banner is live", async () => {
    server.use(...catalogue(3));
    renderRoute("/");
    expect(await screen.findByRole("region", { name: "Hot Games" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Slots, 30 games" })).toHaveAttribute("href", "/games?category=slots");
    expect(await screen.findByRole("region", { name: "Bonuses" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Promotions" })).toBeNull(); // the hero carousel
  });

  it("rotates live banners with dots, and a banner linked to a promotion opens its terms", async () => {
    // msw prefers the earlier handler in one use() call: the banners come first, ahead of the catalogue's empty list
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([
      { id: "b1", placement: "home-hero", title: "Welcome", imageUrl: "https://cdn.example/1.png", imageWidth: 1956, imageHeight: 829, mobileImageUrl: null, mobileImageWidth: null, mobileImageHeight: null, fit: "Cover", promotionId: PROMOTIONS[0]!.id },
      { id: "b2", placement: "home-hero", title: "Reload", imageUrl: "https://cdn.example/2.png", imageWidth: 1956, imageHeight: 829, mobileImageUrl: null, mobileImageWidth: null, mobileImageHeight: null, fit: "Cover", promotionId: null },
    ])), ...catalogue(1));
    renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    expect(within(hero).getAllByRole("button", { name: /Show banner/ })).toHaveLength(2);
    expect(within(hero).getByRole("link", { name: "Welcome" })).toHaveAttribute("href", `/promotions?promo=${PROMOTIONS[0]!.id}`);
    expect(within(hero).getByRole("button", { name: "Pause banner rotation" })).toBeInTheDocument();
  });
});
