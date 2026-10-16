import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { problem, server, signedIn } from "@/test/server";
import { catalogue, game, PROMOTIONS, RELOAD, summary, WELCOME } from "@/test/lobby-fixtures";
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

    await user.click(within(grid).getByRole("button", { name: "Load More Games (12 of 30)" }));
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

describe("Bonuses switched on in the back office (owner 2026-10-13)", () => {
  it("a guest sees them on Promotions in the skin's currency, and Activate asks them to sign in first", async () => {
    const user = userEvent.setup();
    const activate = vi.fn();
    server.use(...catalogue(0), http.post("*/api/bonus/activate", () => { activate(); return HttpResponse.json({}); }));
    renderRoute("/promotions");
    const list = await screen.findByRole("region", { name: /Available bonuses/ });
    expect((await within(list).findAllByRole("article")).map((a) => a.getAttribute("aria-label"))).toEqual(["Welcome Bonus", "Weekly Reload"]);
    const welcome = within(list).getByRole("article", { name: "Welcome Bonus" });
    expect(within(welcome).getByText("₱5,000")).toBeInTheDocument();
    expect(within(welcome).getByText("100% up to")).toBeInTheDocument();
    await user.click(within(welcome).getByRole("button", { name: "Activate" }));
    expect(authDialog.get().mode).toBe("signin");
    expect(activate).not.toHaveBeenCalled();
  });

  it("a player activates only after ticking the terms, then is offered Deposit to claim", async () => {
    const user = userEvent.setup();
    const activated: unknown[] = [];
    let pending = false;
    // msw prefers the earlier handler: the player's catalog first, ahead of the fixtures' guest one
    server.use(signedIn(),
      http.get("*/api/bonus", () => HttpResponse.json([summary(WELCOME, !pending, pending), summary(RELOAD)])),
      http.get("*/api/bonus/active", () => HttpResponse.json([])),
      http.post("*/api/bonus/activate", async ({ request }) => { activated.push(await request.json()); pending = true; return HttpResponse.json({ activationId: "a1" }); }),
      ...catalogue(0));
    const { router } = renderRoute("/promotions");
    const welcome = await screen.findByRole("article", { name: "Welcome Bonus" });
    await user.click(await within(welcome).findByRole("button", { name: "Activate" }));

    const dialog = await screen.findByRole("dialog", { name: "Welcome Bonus" });
    expect(within(dialog).getByText(/20× the bonus amount/)).toBeInTheDocument(); // the terms, built from the definition
    const confirm = within(dialog).getByRole("button", { name: "Activate bonus" });
    expect(confirm).toBeDisabled(); // never on the first press
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(confirm);
    expect(activated).toEqual([{ bonusId: WELCOME.id, code: null }]);
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Activated!");

    await user.click(within(dialog).getByRole("button", { name: "Deposit to claim" }));
    await waitFor(() => expect(router.state.location.href).toBe("/wallet#deposit"));
  });

  it("an activated bonus's tile says Deposit to claim; a running one points to My bonuses", async () => {
    server.use(signedIn(),
      http.get("*/api/bonus", () => HttpResponse.json([summary(WELCOME, false, true), summary(RELOAD, false)])),
      http.get("*/api/bonus/active", () => HttpResponse.json([{ bonusId: RELOAD.id, bonusName: "Weekly Reload", playerBonusId: "pb-1", status: "active", isInUse: true, hasPendingActivation: false, currentStepNumber: 1, totalSteps: 1, currency: "PHP", grantedCents: 1, wageringRequiredCents: 1, wageringCompletedCents: 0, wageringRemainingCents: 1, progressPercent: 0, grantedAt: null, expiresAt: null, closedAt: null, closeReason: null }])),
      ...catalogue(0));
    renderRoute("/promotions");
    expect(await within(await screen.findByRole("article", { name: "Welcome Bonus" })).findByRole("button", { name: "Deposit to claim" })).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Weekly Reload" })).getByRole("button", { name: "In progress — view" })).toBeInTheDocument();
  });

  it("none switched on: Promotions says so, and Home leaves its Bonuses section out", async () => {
    server.use(http.get("*/api/bonus", () => HttpResponse.json([])), ...catalogue(0));
    const { unmount } = renderRoute("/promotions");
    expect(await screen.findByText("0 active offers")).toBeInTheDocument();
    unmount();
    server.use(http.get("*/api/bonus", () => HttpResponse.json([])), ...catalogue(3));
    renderRoute("/");
    expect(await screen.findByRole("region", { name: "Hot Games" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Bonuses" })).toBeNull();
  });
});

describe("Home (P3-27)", () => {
  it("builds every section from core; with no banner live the design's welcome art stands in for the welcome offer", async () => {
    server.use(...catalogue(3));
    renderRoute("/");
    expect(await screen.findByRole("region", { name: "Hot Games" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Slots, 30 games" })).toHaveAttribute("href", "/games?category=slots");
    expect(screen.getByRole("link", { name: "All Games" })).toHaveAttribute("href", "/games");
    const bonuses = await screen.findByRole("region", { name: "Bonuses" });
    const welcome = await within(bonuses).findByRole("article", { name: "Welcome Bonus" }); // the back office's bonus
    expect(within(welcome).getByText("₱5,000")).toBeInTheDocument(); // the headline number on its own line
    expect(within(welcome).getByRole("button", { name: "Activate" })).toBeInTheDocument();
    const hero = await screen.findByRole("region", { name: "Promotions" });
    expect(within(hero).getByRole("link", { name: "Welcome Bonus — 100% up to ₱5,000" })).toHaveAttribute("href", "/promotions");
    expect(within(hero).queryByRole("button", { name: /Show banner/ })).toBeNull(); // one slide: no controls
  });

  it("leaves out the hero when no banner is live and no welcome offer runs", async () => {
    server.use(http.get("*/api/v1/promotions", () => HttpResponse.json(PROMOTIONS.filter((p) => p.category !== "welcome"))), ...catalogue(3));
    renderRoute("/");
    expect(await screen.findByRole("region", { name: "Bonuses" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Promotions" })).toBeNull(); // the hero carousel
  });

  it("rotates live banners with dots, and a banner linked to a promotion opens Promotions", async () => {
    // msw prefers the earlier handler in one use() call: the banners come first, ahead of the catalogue's empty list
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([
      { id: "b1", placement: "home-hero", title: "Welcome", imageUrl: "https://cdn.example/1.png", imageWidth: 1956, imageHeight: 829, mobileImageUrl: null, mobileImageWidth: null, mobileImageHeight: null, fit: "Cover", promotionId: PROMOTIONS[0]!.id },
      { id: "b2", placement: "home-hero", title: "Reload", imageUrl: "https://cdn.example/2.png", imageWidth: 1956, imageHeight: 829, mobileImageUrl: null, mobileImageWidth: null, mobileImageHeight: null, fit: "Cover", promotionId: null },
    ])), ...catalogue(1));
    renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    expect(within(hero).getAllByRole("button", { name: /Show banner/ })).toHaveLength(2);
    expect(within(hero).getByRole("link", { name: "Welcome" })).toHaveAttribute("href", "/promotions");
    expect(within(hero).getByRole("button", { name: "Pause banner rotation" })).toBeInTheDocument();
  });

  // Owner 2026-10-15: a banner opens a page of the site by relative path, set in the back office.
  const linked = (id: string, title: string | null, linkUrl: string | null, promotionId: string | null = null) => ({
    id, placement: "home-hero", title, imageUrl: `https://cdn.example/${id}.png`, imageWidth: 1956, imageHeight: 829,
    mobileImageUrl: null, mobileImageWidth: null, mobileImageHeight: null, fit: "Cover", promotionId, linkUrl,
  });

  it("a banner with a page link is a real link the router follows — query and hash included", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([linked("b1", "Slots week", "/games?category=slots"), linked("b2", "Top up", "/wallet#deposit")])), ...catalogue(1));
    const { router } = renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    const slots = within(hero).getByRole("link", { name: "Slots week" });
    expect(slots).toHaveAttribute("href", "/games?category=slots");
    expect(slots).toHaveAttribute("tabindex", "0"); // the showing slide is reachable by keyboard…
    expect(within(hero).getByRole("link", { name: "Top up", hidden: true })).toHaveAttribute("tabindex", "-1"); // …the hidden one is not

    await userEvent.setup().click(slots);
    await waitFor(() => expect(router.state.location.pathname).toBe("/games"));
    expect(router.state.location.search).toEqual({ category: "slots" });
  });

  it("Enter on the focused banner follows it; a modified click is left to the browser", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([linked("b1", "VIP club", "/vip")])), ...catalogue(1));
    const { router } = renderRoute("/");
    const vip = within(await screen.findByRole("region", { name: "Promotions" })).getByRole("link", { name: "VIP club" });

    const newTab = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
    vip.dispatchEvent(newTab);
    expect(newTab.defaultPrevented).toBe(false); // ⌘-click: the browser opens a tab, the page stays
    expect(router.state.location.pathname).toBe("/");

    vip.focus();
    await userEvent.setup().keyboard("{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/vip"));
  });

  it("a link that is neither a same-site path nor a public https address is never rendered — the banner is a picture", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([
      linked("b1", "Evil", "//evil.example"), linked("b2", "Script", "javascript:alert(1)"), linked("b3", "Plain", "http://evil.example/games"),
    ])), ...catalogue(1));
    renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    expect(within(hero).queryAllByRole("link", { hidden: true })).toEqual([]);
    expect(hero.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(3);
    expect(within(hero).getAllByRole("img", { hidden: true })).toHaveLength(1); // the rest arrive as rotation reaches them
  });

  // Owner 2026-10-16: on a slow network the five banners all downloaded at once and the first appeared last.
  it("fetches only the shown banner at first, at high priority, pulsing until it loads; the next joins once it has", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([linked("b1", "Slots week", "/games?category=slots"), linked("b2", "VIP club", "/vip"), linked("b3", "Top up", "/wallet#deposit")])), ...catalogue(1));
    renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    const first = within(hero).getByRole("img", { name: "Slots week" });
    expect(within(hero).getAllByRole("img", { hidden: true })).toEqual([first]);
    expect(first).toHaveAttribute("fetchpriority", "high");
    expect(first).toHaveClass("opacity-0"); // not yet: the frame pulses behind it
    expect(hero.querySelector(".motion-safe\\:animate-pulse")).not.toBeNull();

    fireEvent.load(first);
    expect(first).toHaveClass("opacity-100"); // fades in…
    expect(hero.querySelector(".motion-safe\\:animate-pulse")).toBeNull(); // …and the pulse is gone
    const next = within(hero).getByRole("img", { name: "VIP club", hidden: true });
    expect(next).toHaveAttribute("fetchpriority", "low"); // only now, and behind everything else
    expect(within(hero).queryByRole("img", { name: "Top up", hidden: true })).toBeNull(); // the one after waits its turn
    // every slide is still there, link and all — only the downloads wait
    expect(within(hero).getByRole("link", { name: "Top up", hidden: true })).toHaveAttribute("href", "/wallet#deposit");
  });

  it("never rotates to a banner whose picture has not loaded; moves on the moment it lands, and skips one that fails", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([linked("b1", "Slots week", "/games?category=slots"), linked("b2", "VIP club", "/vip"), linked("b3", "Top up", "/wallet#deposit")])), ...catalogue(1));
    renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    const dot = (n: number) => within(hero).getByRole("button", { name: `Show banner ${n} of 3` });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      act(() => vi.advanceTimersByTime(5000));
      expect(dot(1)).toHaveAttribute("aria-current", "true"); // the 3 s only start once a banner is on screen

      fireEvent.load(within(hero).getByRole("img", { name: "Slots week" }));
      act(() => vi.advanceTimersByTime(3000));
      expect(dot(1)).toHaveAttribute("aria-current", "true"); // time is up, but banner 2 is still on its way

      fireEvent.load(within(hero).getByRole("img", { name: "VIP club", hidden: true }));
      expect(dot(2)).toHaveAttribute("aria-current", "true"); // it landed: straight on

      fireEvent.error(within(hero).getByRole("img", { name: "Top up", hidden: true }));
      act(() => vi.advanceTimersByTime(3000));
      expect(dot(1)).toHaveAttribute("aria-current", "true"); // banner 3 never loaded: round to banner 1

      act(() => vi.advanceTimersByTime(3000));
      expect(dot(2)).toHaveAttribute("aria-current", "true");
      fireEvent.click(within(hero).getByRole("button", { name: "Pause banner rotation" }));
      act(() => vi.advanceTimersByTime(9000));
      expect(dot(2)).toHaveAttribute("aria-current", "true"); // paused stays put
    } finally {
      vi.useRealTimers();
    }
  });

  it("another website opens in a new tab, marked sponsored, and the app stays where it is (owner 2026-10-16)", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([linked("b1", "Partner offer", "https://partner.example/offer?src=chocho")])), ...catalogue(1));
    const { router } = renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    const partner = within(hero).getByRole("link", { name: "Partner offer (opens in a new tab)" });
    expect(partner).toHaveAttribute("href", "https://partner.example/offer?src=chocho");
    expect(partner).toHaveAttribute("target", "_blank");
    expect(partner).toHaveAttribute("rel", "noopener noreferrer sponsored nofollow");

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    partner.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false); // the browser opens the tab; the router is not involved
    expect(router.state.location.pathname).toBe("/");
  });

  it("a swipe on an external banner opens nothing", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([linked("b1", "Partner offer", "https://partner.example/"), linked("b2", "VIP club", "/vip")])), ...catalogue(1));
    renderRoute("/");
    const partner = within(await screen.findByRole("region", { name: "Promotions" })).getByRole("link", { name: "Partner offer (opens in a new tab)" });
    const touch = (x: number) => ({ clientX: x, clientY: 100 }) as Touch;
    fireEvent.touchStart(partner, { touches: [touch(300)] });
    fireEvent.touchEnd(partner, { changedTouches: [touch(120)] });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    partner.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it("a swipe changes slide without following the link", async () => {
    server.use(http.get("*/api/v1/banners", () => HttpResponse.json([linked("b1", "Slots week", "/games?category=slots"), linked("b2", "VIP club", "/vip")])), ...catalogue(1));
    const { router } = renderRoute("/");
    const hero = await screen.findByRole("region", { name: "Promotions" });
    const slots = within(hero).getByRole("link", { name: "Slots week" });
    const touch = (x: number) => ({ clientX: x, clientY: 100 }) as Touch;
    fireEvent.touchStart(slots, { touches: [touch(300)] });
    fireEvent.touchEnd(slots, { changedTouches: [touch(120)] });
    fireEvent.click(slots); // the click some browsers still send at the end of the gesture
    expect(router.state.location.pathname).toBe("/");
    expect(within(hero).getByRole("button", { name: "Show banner 2 of 2" })).toHaveAttribute("aria-current", "true");

    // a plain tap afterwards does follow
    fireEvent.touchStart(within(hero).getByRole("link", { name: "VIP club" }), { touches: [touch(200)] });
    fireEvent.touchEnd(within(hero).getByRole("link", { name: "VIP club" }), { changedTouches: [touch(202)] });
    fireEvent.click(within(hero).getByRole("link", { name: "VIP club" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/vip"));
  });
});
