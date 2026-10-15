import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { cookieSession, problem, server, SESSIONS, signedIn } from "@/test/server";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { queryKeys } from "@/lib/queryKeys";
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
    segments: SEGMENTS, todaySpin: null, ...over,
  };
}

const spinOf = (position: number, over: Record<string, unknown> = {}) => {
  const s = SEGMENTS[position]!;
  return {
    spinId: "0192b0a0-0000-7000-8000-0000000002aa", segmentId: s.id, segmentPosition: position, label: s.label, prizeType: s.prizeType,
    outcome: "granted", currency: "PHP", amountCents: s.amountCents, freeSpinsCount: s.freeSpinsCount, spinDay: "2026-10-15",
    spunAt: new Date().toISOString(), nextSpinAt: new Date(Date.now() + 5 * HOUR).toISOString(), replayed: false,
    proof: { seed: "seed", roll: 7, totalWeight: 10, eligibleWeights: "1,1,1,1" }, ...over,
  };
};

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

    // the wheel is read again (spun today): the countdown takes the button's place, the wheel stays where it landed
    expect(await screen.findByRole("timer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /spin/i })).toBeNull();
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
    expect(screen.queryByRole("button", { name: /spin/i })).toBeNull();
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
    expect(screen.queryByRole("button", { name: /spin/i })).toBeNull();
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
    expect(screen.queryByRole("button", { name: /spin/i })).toBeNull();
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

  it("a direct visit while there is no wheel shows the resting page", async () => {
    renderRoute("/lucky-wheel"); // the default answer: unavailable
    expect(await screen.findByRole("heading", { name: "Lucky Wheel is resting" })).toBeInTheDocument();
    expect(navLabels()).not.toContain("Lucky Wheel");
  });
});
