import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { cookieSession, problem, server, SESSIONS, signedIn } from "@/test/server";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { queryKeys } from "@/lib/queryKeys";
import { game } from "@/test/lobby-fixtures";
import { segmentAtPointer } from "./geometry";

/** The wheel as bonus answers it: four slices clockwise from the pointer. */
const seg = (position: number, over: object) => ({
  id: `0192b0a0-0000-7000-8000-00000000010${position}`, position, label: "", color: null, prizeType: "noPrize",
  amountCents: null, freeSpinsCount: null, eligible: true, ...over,
});
const SEGMENTS = [
  seg(0, { label: "₱100 Bonus", prizeType: "bonusMoney", amountCents: 10_000 }),
  seg(1, { label: "Try again" }),
  seg(2, { label: "10 Free Spins", prizeType: "freeSpins", freeSpinsCount: 10 }),
  seg(3, { label: "₱500 Bonus", prizeType: "bonusMoney", amountCents: 50_000 }),
];
const HOUR = 3_600_000;

function wheel(state: string, over: Record<string, unknown> = {}) {
  const serverTime = Date.now();
  return {
    available: state !== "unavailable", state, name: null, currency: "PHP", timeZone: "Asia/Manila",
    serverTime: new Date(serverTime).toISOString(), nextSpinAt: new Date(serverTime + 3 * HOUR + 25 * 60_000 + 10_000).toISOString(),
    segments: SEGMENTS, todaySpin: null, pendingChoices: [], extraSpins: 0, ...over,
  };
}

const spinOf = (position: number, over: Record<string, unknown> = {}) => {
  const s = SEGMENTS[position]!;
  return {
    spinId: "0192b0a0-0000-7000-8000-0000000002aa", segmentId: s.id, segmentPosition: position, label: s.label, prizeType: s.prizeType,
    outcome: "granted", currency: "PHP", amountCents: s.amountCents, freeSpinsCount: s.freeSpinsCount, spinDay: "2026-10-15",
    spunAt: new Date().toISOString(), nextSpinAt: new Date(Date.now() + 5 * HOUR).toISOString(), replayed: false,
    proof: { seed: "seed", roll: 7, totalWeight: 10, eligibleWeights: "1,1,1,1" }, freeSpinGameIds: [], chosenGameId: null, chooseBy: null,
    source: "daily", ...over,
  };
};

/** The lobby's games a free-spins prize may be played on (one of them cannot be read). */
const GAME_ID = (n: number) => `00000000-0000-7000-8000-00000000090${n}`;
const GAMES: Record<string, { name: string; providerName: string }> = {
  [GAME_ID(1)]: { name: "Sweet Bonanza", providerName: "Pragmatic Play" },
  [GAME_ID(2)]: { name: "Gates of Olympus", providerName: "Pragmatic Play" },
};
const gameReads = () => http.get("*/api/v1/games/:id", ({ params }) => {
  const g = GAMES[String(params.id)];
  if (!g) return problem(404, "NOT_FOUND");
  return HttpResponse.json({ ...game(1), id: String(params.id), ...g, logoUrl: null, description: null, rtp: null, volatility: null });
});
const CHOOSE_BY = "2026-10-18T15:59:00Z";
/** 10 free spins on any of three games (the third cannot be read): waiting for the player's pick. */
const awaiting = (over: Record<string, unknown> = {}) =>
  spinOf(2, { outcome: "awaitingGame", freeSpinGameIds: [GAME_ID(1), GAME_ID(2), GAME_ID(3)], chooseBy: CHOOSE_BY, ...over });

const hub = () => screen.getByTestId("wheel-hub");

/** The bottom nav's links (the header's nav is "Primary" too, but carries no Wallet). */
const bottomNav = () => screen.getAllByRole("navigation", { name: "Primary" }).find((nav) => within(nav).queryByRole("link", { name: "Wallet" }))!;
const navLabels = () => within(bottomNav()).getAllByRole("link").map((a) => a.textContent);

const rotation = () => Number(/rotate\((-?[\d.e+-]+)deg\)/.exec(screen.getByTestId("wheel-rotor").style.transform)?.[1] ?? NaN);

// The landing animation is the design's 3.6 s; under reduced motion it is a jump, which keeps these tests quick.
beforeEach(() => {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion"), media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }) as unknown as MediaQueryList);
});
afterEach(() => {
  vi.restoreAllMocks();
  authDialog.close();
});

describe("the Lucky Wheel page", () => {
  it("is the bottom nav's Lucky Wheel, shown as the current page", async () => {
    server.use(http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("signInRequired"))));
    renderRoute("/lucky-wheel");
    const link = await waitFor(() => within(bottomNav()).getByRole("link", { name: "Lucky Wheel" }));
    expect(link).toHaveAttribute("href", "/lucky-wheel");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("heading", { level: 1, name: "Lucky Wheel" })).toBeInTheDocument();
    expect(screen.getByText("Your spin resets every day at midnight, Manila time.")).toBeInTheDocument();
  });

  it("a guest sees the wheel, and Spin opens sign-in; once signed in the wheel is read again and can be spun", async () => {
    const user = userEvent.setup();
    let player = false;
    const spin = vi.fn();
    server.use(
      http.get("*/api/id/sessions", () => (player ? HttpResponse.json(SESSIONS) : problem(401, "UNAUTHORIZED"))),
      http.post("*/api/id/auth/signin", () => { player = true; return cookieSession(); }),
      http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel(player ? "ready" : "signInRequired"))),
      http.post("*/api/bonus/wheel/spin", () => { spin(); return HttpResponse.json(spinOf(1)); }),
    );
    renderRoute("/lucky-wheel");

    expect(await screen.findByText("Sign in to take today’s free spin.")).toBeInTheDocument();
    expect(screen.getByTestId("wheel-rotor").querySelectorAll("[data-slice]")).toHaveLength(4);
    // the hub is the Spin (no logo there any more), and a guest's tap asks them to sign in
    expect(hub()).toHaveTextContent("Spin");
    expect(hub()).toBeEnabled();
    expect(hub().parentElement!.querySelector("img")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sign in to spin the Lucky Wheel" }));
    expect(authDialog.get()).toMatchObject({ mode: "signin", returnTo: "/lucky-wheel" });
    expect(spin).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: "Welcome back to ChoCho" });
    await user.click(within(dialog).getByRole("tab", { name: "Email" }));
    await user.type(within(dialog).getByLabelText("Email address"), "juan@example.test");
    await user.type(within(dialog).getByLabelText("Password"), "right-pass-1");
    await user.click(within(dialog).getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("button", { name: "Spin the Lucky Wheel" })).toBeEnabled();
    expect(screen.getByText("One free spin a day. Tap Spin to try your luck.")).toBeInTheDocument();
  });

  it("ready: Spin asks bonus once, lands the pointer on the slice it answered, and shows the prize", async () => {
    const user = userEvent.setup();
    let spun = false;
    const spins: unknown[] = [];
    server.use(signedIn(),
      http.get("*/api/bonus/wheel", () => HttpResponse.json(spun ? wheel("spunToday", { todaySpin: spinOf(3, { replayed: true }) }) : wheel("ready"))),
      http.post("*/api/bonus/wheel/spin", () => { spins.push(1); spun = true; return HttpResponse.json(spinOf(3)); }),
    );
    renderRoute("/lucky-wheel");
    const button = await screen.findByRole("button", { name: "Spin the Lucky Wheel" });
    expect(segmentAtPointer(rotation(), 4)).toBe(0); // at rest on the first slice
    await user.click(button);

    const result = await screen.findByTestId("wheel-result");
    expect(within(result).getByRole("heading", { name: "You won ₱500 bonus!" })).toBeInTheDocument();
    expect(result).toHaveTextContent("Wagering applies before it can be withdrawn.");
    expect(within(result).getByRole("link", { name: "View my bonuses" })).toHaveAttribute("href", "/account?tab=bonuses");
    expect(result.closest("[aria-live]")).toHaveAttribute("aria-live", "polite"); // announced
    expect(segmentAtPointer(rotation(), 4)).toBe(3);
    expect(spins).toHaveLength(1);

    // the wheel is read again (spun today): the hub says Spun, the countdown shows, the wheel stays where it landed
    expect(await screen.findByRole("timer")).toBeInTheDocument();
    expect(hub()).toBeDisabled();
    expect(hub()).toHaveTextContent("Spun");
    expect(hub()).toHaveAccessibleName("Spun — you’ve used today’s spin");
    expect(screen.queryByRole("button", { name: "Spin the Lucky Wheel" })).toBeNull();
    expect(screen.getByText("Next free spin in")).toBeInTheDocument();
    expect(segmentAtPointer(rotation(), 4)).toBe(3);
  });

  it("spun today: a reload shows the wheel stopped on today's slice, the prize and the countdown on the server's clock — no spin", async () => {
    const spin = vi.fn();
    // the phone's clock is an hour fast: the server's time is what counts
    const serverTime = Date.now() - HOUR;
    server.use(signedIn(),
      http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("spunToday", {
        serverTime: new Date(serverTime).toISOString(),
        nextSpinAt: new Date(serverTime + 2 * HOUR + 5 * 60_000 + 30_000).toISOString(),
        todaySpin: spinOf(2, { replayed: true }),
      }))),
      http.post("*/api/bonus/wheel/spin", () => { spin(); return HttpResponse.json(spinOf(2)); }),
    );
    renderRoute("/lucky-wheel");

    const result = await screen.findByTestId("wheel-result");
    expect(within(result).getByRole("heading", { name: "You won 10 free spins!" })).toBeInTheDocument();
    expect(segmentAtPointer(rotation(), 4)).toBe(2);
    expect(screen.getByRole("timer").textContent).toMatch(/^02:05:(30|29|28)$/);
    expect(hub()).toBeDisabled();
    expect(hub()).toHaveTextContent("Spun");
    expect(spin).not.toHaveBeenCalled();
  });

  it("a 409 WHEEL_NOT_AVAILABLE re-reads the wheel and shows where it stands (closed today, opens in …)", async () => {
    const user = userEvent.setup();
    let closed = false;
    server.use(signedIn(),
      http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel(closed ? "closedToday" : "ready"))),
      http.post("*/api/bonus/wheel/spin", () => { closed = true; return problem(409, "WHEEL_NOT_AVAILABLE"); }),
    );
    renderRoute("/lucky-wheel");
    await user.click(await screen.findByRole("button", { name: "Spin the Lucky Wheel" }));

    expect(await screen.findByRole("heading", { name: "The wheel is closed today" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The wheel changed just as you spun, so no spin was used.");
    expect(screen.getByText("Opens again in")).toBeInTheDocument();
    expect(screen.getByRole("timer").textContent).toMatch(/^03:25:(10|09|08)$/);
    expect(screen.queryByTestId("wheel-result")).toBeNull();
    expect(hub()).toBeDisabled();
    expect(hub()).toHaveTextContent("Closed");
  });

  it("marks a slice the player cannot land on now, on the wheel and in words", async () => {
    server.use(signedIn(), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("ready", {
      segments: SEGMENTS.map((s) => (s.position === 3 ? { ...s, eligible: false } : s)),
    }))));
    renderRoute("/lucky-wheel");
    await screen.findByRole("button", { name: "Spin the Lucky Wheel" });

    const rotor = screen.getByTestId("wheel-rotor");
    expect(rotor.querySelector('[data-slice="3"]')).toHaveAttribute("data-eligible", "false");
    expect(rotor.querySelector('[data-slice="0"]')).toHaveAttribute("data-eligible", "true");
    expect(screen.getByText("₱500 bonus (not available to you right now)")).toBeInTheDocument();
    expect(screen.getByText(/Greyed-out prizes can’t be won right now/)).toBeInTheDocument();
  });

  it.each([
    ["unavailable", "Lucky Wheel is resting"],
    ["ended", "This wheel has ended"],
    ["restricted", "The Lucky Wheel isn’t available on your account"],
  ])("%s: no wheel to spin, a friendly word and a way back", async (state, title) => {
    server.use(signedIn(), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel(state, state === "unavailable" ? { segments: [] } : {}))));
    renderRoute("/lucky-wheel");
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: /spin/i })).toBeNull();
    if (state === "restricted") expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
  });

  it("nothing to win: explains that finishing the current bonus unlocks the prizes", async () => {
    server.use(signedIn(), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("nothingToWin", {
      segments: SEGMENTS.map((s) => ({ ...s, eligible: s.prizeType !== "bonusMoney" })),
    }))));
    renderRoute("/lucky-wheel");
    expect(await screen.findByRole("heading", { name: "Finish your bonus to unlock the prizes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View my bonuses" })).toHaveAttribute("href", "/account?tab=bonuses");
    expect(hub()).toBeDisabled();
    expect(hub()).toHaveTextContent("Locked");
  });

  it("a prize that could not be credited sends the player to support", async () => {
    server.use(signedIn(), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("spunToday", { todaySpin: spinOf(0, { outcome: "failed" }) }))));
    renderRoute("/lucky-wheel");
    const result = await screen.findByTestId("wheel-result");
    expect(within(result).getByRole("heading", { name: "You won ₱100 bonus!" })).toBeInTheDocument();
    expect(result).toHaveTextContent("Please contact support");
    await waitFor(() => expect(within(result).getByRole("button", { name: "Contact support" })).toBeEnabled());
  });
});

describe("the hub is the Spin (owner 2026-10-16)", () => {
  it.each([
    ["ready", "Spin", "Spin the Lucky Wheel", true],
    ["signInRequired", "Spin", "Sign in to spin the Lucky Wheel", true],
    ["spunToday", "Spun", "Spun — you’ve used today’s spin", false],
    ["closedToday", "Closed", "Closed — the wheel is closed today", false],
    ["nothingToWin", "Locked", "Locked — finish your current bonus to unlock the prizes", false],
  ] as const)("%s: reads “%s”", async (state, text, name, enabled) => {
    server.use(...(state === "signInRequired" ? [] : [signedIn()]), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel(state, {
      todaySpin: state === "spunToday" ? spinOf(1) : null,
    }))));
    renderRoute("/lucky-wheel");
    const button = await screen.findByRole("button", { name });
    expect(button).toBe(hub());
    expect(button).toHaveTextContent(text);
    if (enabled) expect(button).toBeEnabled();
    else expect(button).toBeDisabled();
    // the old Spin under the wheel is gone: the hub is the only spin control
    expect(screen.queryAllByRole("button", { name: /^(Spin|Sign in to spin)/ })).toHaveLength(enabled ? 1 : 0);
  });
});

describe("free spins on several games: the player picks one", () => {
  it("a fresh spin that lands on them offers the games (read from the lobby), and a pick is confirmed, sent and played", async () => {
    const user = userEvent.setup();
    let state: "ready" | "awaiting" | "chosen" = "ready";
    const chosen: { spinId: string; body: unknown }[] = [];
    const credited = () => awaiting({ outcome: "granted", chosenGameId: GAME_ID(1), replayed: true });
    server.use(signedIn(), gameReads(),
      http.get("*/api/bonus/wheel", () => HttpResponse.json(
        state === "ready" ? wheel("ready")
          : wheel("spunToday", { todaySpin: state === "chosen" ? credited() : awaiting({ replayed: true }), pendingChoices: state === "chosen" ? [] : [awaiting()] }),
      )),
      http.post("*/api/bonus/wheel/spin", () => { state = "awaiting"; return HttpResponse.json(awaiting()); }),
      http.post("*/api/bonus/wheel/spins/:spinId/choose", async ({ params, request }) => {
        chosen.push({ spinId: String(params.spinId), body: await request.json() });
        state = "chosen";
        return HttpResponse.json(credited());
      }),
    );
    renderRoute("/lucky-wheel");
    await user.click(await screen.findByRole("button", { name: "Spin the Lucky Wheel" }));

    const result = await screen.findByTestId("wheel-result");
    expect(within(result).getByRole("heading", { name: "You won 10 free spins!" })).toBeInTheDocument();
    const card = await screen.findByTestId("wheel-choice");
    expect(card).toHaveTextContent("Choose your game");
    expect(card).toHaveTextContent(/Choose by Oct 18, 2026/);
    const list = within(card).getByRole("list", { name: "Games you can choose" });
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(2)); // the unreadable third is left out
    expect(within(list).getByRole("button", { name: /Sweet Bonanza/ })).toHaveTextContent("Pragmatic Play");
    expect(within(list).getByRole("button", { name: /Gates of Olympus/ })).toBeInTheDocument();
    // today's prize is offered once — under the wheel, not again in the waiting list
    expect(screen.getAllByTestId("wheel-choice")).toHaveLength(1);

    await user.click(within(list).getByRole("button", { name: /Sweet Bonanza/ }));
    const dialog = await screen.findByRole("dialog", { name: "Play your free spins on Sweet Bonanza?" });
    expect(dialog).toHaveTextContent("Your 10 free spins will be added to Sweet Bonanza. You can’t change the game afterwards.");
    expect(chosen).toHaveLength(0); // nothing is sent before the player confirms
    await user.click(within(dialog).getByRole("button", { name: "Yes, choose this game" }));

    expect(await screen.findByRole("heading", { name: "10 free spins on Sweet Bonanza" })).toBeInTheDocument();
    expect(chosen).toEqual([{ spinId: awaiting().spinId, body: { gameId: GAME_ID(1) } }]);
    expect(screen.getByRole("link", { name: "Play now: Sweet Bonanza" })).toHaveAttribute("href", `/games/${GAME_ID(1)}/sweet-bonanza`);
    expect(screen.queryByRole("list", { name: "Games you can choose" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a pick after the deadline (409 WHEEL_NOT_AVAILABLE) says the time to choose has passed, and the wheel is read again", async () => {
    const user = userEvent.setup();
    let reads = 0;
    server.use(signedIn(), gameReads(),
      http.get("*/api/bonus/wheel", () => { reads += 1; return HttpResponse.json(wheel("spunToday", { todaySpin: awaiting({ replayed: true }), pendingChoices: [awaiting()] })); }),
      http.post("*/api/bonus/wheel/spins/:spinId/choose", () => problem(409, "WHEEL_NOT_AVAILABLE")),
    );
    renderRoute("/lucky-wheel");
    await user.click(await screen.findByRole("button", { name: /Gates of Olympus/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes, choose this game" }));

    expect(await screen.findByRole("heading", { name: "The time to choose has passed" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Games you can choose" })).toBeNull();
    await waitFor(() => expect(reads).toBeGreaterThan(1));
  });

  it("a prize from an earlier day waits on the page — and in the bottom nav — even while the wheel is switched off", async () => {
    server.use(signedIn(), gameReads(), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("unavailable", {
      available: false, segments: [], pendingChoices: [awaiting({ spinDay: "2026-10-14" })],
    }))));
    renderRoute("/lucky-wheel");
    expect(await screen.findByRole("heading", { name: "Choose a game for your free spins" })).toBeInTheDocument();
    const card = screen.getByTestId("wheel-choice");
    expect(card).toHaveTextContent("Won on Oct 14, 2026");
    expect(within(card).getByRole("heading", { name: "10 free spins" })).toBeInTheDocument();
    expect(await within(card).findByRole("button", { name: /Sweet Bonanza/ })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Lucky Wheel is resting" })).toBeInTheDocument();
    await waitFor(() => expect(navLabels()).toContain("Lucky Wheel"));
  });

  it("free spins on a single game are credited at once and name their game, with Play now", async () => {
    server.use(signedIn(), gameReads(), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("spunToday", {
      todaySpin: spinOf(2, { freeSpinGameIds: [GAME_ID(2)], replayed: true }),
    }))));
    renderRoute("/lucky-wheel");
    const result = await screen.findByTestId("wheel-result");
    expect(within(result).getByRole("heading", { name: "You won 10 free spins!" })).toBeInTheDocument();
    expect(await within(result).findByText("Your free spins are ready on Gates of Olympus.")).toBeInTheDocument();
    expect(within(result).getByRole("link", { name: "Play now: Gates of Olympus" })).toHaveAttribute("href", `/games/${GAME_ID(2)}/gates-of-olympus`);
    expect(screen.queryByTestId("wheel-choice")).toBeNull();
  });
});

describe("extra spins an operator gave the player", () => {
  it("after the daily spin the hub is ready again, shows how many are left, and each tap sends its own requestId", async () => {
    const user = userEvent.setup();
    let extra = 2;
    let latest = spinOf(1, { replayed: true }); // today's daily spin, already used
    const bodies: { requestId?: string }[] = [];
    server.use(signedIn(),
      http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel(extra > 0 ? "ready" : "spunToday", { todaySpin: latest, extraSpins: extra }))),
      http.post("*/api/bonus/wheel/spin", async ({ request }) => {
        bodies.push((await request.json()) as { requestId?: string });
        extra -= 1;
        latest = spinOf(3, { spinId: `0192b0a0-0000-7000-8000-0000000002b${bodies.length}`, source: "granted" });
        return HttpResponse.json(latest);
      }),
    );
    renderRoute("/lucky-wheel");

    expect(await screen.findByTestId("wheel-extra")).toHaveTextContent("+2 extra spins");
    expect(hub()).toHaveTextContent("Spin");
    expect(hub()).toBeEnabled();
    expect(screen.getByText("Next free daily spin in")).toBeInTheDocument(); // the daily countdown, as a footnote
    expect(within(screen.getByTestId("wheel-result")).getByRole("heading", { name: "No luck today" })).toBeInTheDocument();
    // a miss with extra spins left is not "come back tomorrow"
    expect(screen.getByTestId("wheel-result")).toHaveTextContent("you still have extra spins");

    await user.click(hub());
    const result = await screen.findByTestId("wheel-result");
    await waitFor(() => expect(within(result).getByRole("heading", { name: "You won ₱500 bonus!" })).toBeInTheDocument());
    expect(result).toHaveTextContent("Extra spin");
    await waitFor(() => expect(screen.getByTestId("wheel-extra")).toHaveTextContent("+1 extra spin"));
    expect(hub()).toHaveTextContent("Spin");
    expect(hub()).toBeEnabled();

    await user.click(hub());
    await waitFor(() => expect(screen.queryByTestId("wheel-extra")).toBeNull());
    await waitFor(() => expect(hub()).toHaveTextContent("Spun"));
    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(bodies[1]!.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(bodies[0]!.requestId).not.toBe(bodies[1]!.requestId);
  });

  it("a tap whose answer was lost is retried with the same requestId, so it never spends a second spin", async () => {
    const user = userEvent.setup();
    const ids: string[] = [];
    server.use(signedIn(),
      http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("ready", { todaySpin: spinOf(1, { replayed: true }), extraSpins: 1 }))),
      http.post("*/api/bonus/wheel/spin", async ({ request }) => {
        ids.push(((await request.json()) as { requestId: string }).requestId);
        return ids.length === 1 ? problem(502, "UPSTREAM_UNAVAILABLE") : HttpResponse.json(spinOf(0, { source: "granted", spinId: "0192b0a0-0000-7000-8000-0000000002c1" }));
      }),
    );
    renderRoute("/lucky-wheel");
    await user.click(await screen.findByRole("button", { name: "Spin the Lucky Wheel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The spin didn’t go through.");
    await user.click(hub());
    await waitFor(() => expect(ids).toHaveLength(2));
    expect(ids[1]).toBe(ids[0]);
  });
});

describe("the bottom nav's Lucky Wheel (owner 2026-10-15: only while the skin has a wheel)", () => {
  it("is hidden while bonus says there is no wheel (four items), and appears once it is switched on", async () => {
    let on = false;
    server.use(http.get("*/api/bonus/wheel", () => HttpResponse.json(on ? wheel("closedToday") : wheel("unavailable", { available: false, segments: [] }))));
    const { queryClient } = renderRoute("/promotions");
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.session.wheel())).toBeDefined());
    expect(navLabels()).toEqual(["Home", "Games", "Wallet", "Bonuses"]);
    expect(bottomNav()).toHaveClass("grid-cols-4");

    on = true; // switched on in the back office; closed today still means there is a wheel
    await queryClient.invalidateQueries({ queryKey: queryKeys.session.wheel() });
    await waitFor(() => expect(navLabels()).toEqual(["Home", "Games", "Wallet", "Bonuses", "Lucky Wheel"]));
    expect(bottomNav()).toHaveClass("grid-cols-5");
    expect(within(bottomNav()).getByRole("link", { name: "Lucky Wheel" })).toHaveAttribute("href", "/lucky-wheel");
  });

  it("is not flashed while the wheel is still loading, nor shown when it cannot be read", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    server.use(http.get("*/api/bonus/wheel", async () => { await gate; return problem(502, "UPSTREAM_UNAVAILABLE"); }));
    const { queryClient } = renderRoute("/vip");
    await waitFor(() => expect(navLabels()).toHaveLength(4));
    expect(navLabels()).not.toContain("Lucky Wheel");
    release();
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.session.wheel())?.status).toBe("error"));
    expect(navLabels()).toEqual(["Home", "Games", "Wallet", "Bonuses"]);
  });

  it("is shown while the wheel is off if the player has extra spins there", async () => {
    server.use(signedIn(), http.get("*/api/bonus/wheel", () => HttpResponse.json(wheel("unavailable", { available: false, segments: [], extraSpins: 3 }))));
    renderRoute("/promotions");
    await waitFor(() => expect(navLabels()).toContain("Lucky Wheel"));
  });

  it("a direct visit while there is no wheel shows the resting page", async () => {
    renderRoute("/lucky-wheel"); // the default answer: unavailable
    expect(await screen.findByRole("heading", { name: "Lucky Wheel is resting" })).toBeInTheDocument();
    expect(navLabels()).not.toContain("Lucky Wheel");
  });
});
