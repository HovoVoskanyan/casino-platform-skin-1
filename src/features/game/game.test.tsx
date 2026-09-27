import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { problem, server, signedIn } from "@/test/server";
import { catalogue, game } from "@/test/lobby-fixtures";
import { authDialog } from "@/features/auth/auth-dialog-state";

const G = game(1, { name: "Sweet Bonanza" });
const detail = (extra: object = {}) => http.get("*/api/v1/games/:id", () => HttpResponse.json({ ...G, logoUrl: null, description: null, rtp: null, volatility: null, ...extra }));
const eligibility = (eligible: boolean) =>
  http.get("*/api/bonus/launch-eligibility", () => HttpResponse.json({ hasActiveBonus: eligible, isGameEligible: eligible, bonusName: eligible ? "Welcome Bonus" : null, wageringRequiredCents: 0, wageringCompletedCents: 0, totalSteps: 1 }));
const answer = (mode: string, funding = "real") => ({ launchId: crypto.randomUUID(), gameId: G.id, gameCode: "vs20", mode, funding, currency: "PHP", language: "en", playerBonusId: null, html: `<div id="provider">${mode}</div>` });

function launches(respond: (body: Record<string, unknown>) => Response) {
  const bodies: Record<string, unknown>[] = [];
  server.use(http.post("*/api/v1/games/:id/launch", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    bodies.push(body);
    return respond(body);
  }));
  return bodies;
}

describe("game launch (P3-28)", () => {
  afterEach(() => {
    authDialog.close();
    sessionStorage.clear();
  });

  it("a guest is asked to sign in and will come back to the game in the mode they chose", async () => {
    const user = userEvent.setup();
    server.use(...catalogue(1), detail());
    renderRoute(`/games/${G.id}`);

    await user.click(await screen.findByRole("button", { name: "Play for Real" }));
    const ask = screen.getByRole("dialog", { name: "Sign in to continue" });
    expect(within(ask).getByText(/back to Sweet Bonanza in real-money mode/)).toBeInTheDocument();
    await user.click(within(ask).getByRole("button", { name: "Continue to Sign in" }));

    expect(await screen.findByText("Welcome back to ChoCho")).toBeInTheDocument();
    expect(authDialog.get().returnTo).toBe(`/games/${G.id}?play=real`);
    expect(sessionStorage.getItem("chocho:playAfterSignIn")).toBe(`${G.id}:real`); // what lets the return open it
  });

  it("demo opens the provider's fragment in the sandboxed container", async () => {
    const user = userEvent.setup();
    const bodies = launches((b) => HttpResponse.json(answer(String(b.mode))));
    server.use(signedIn(), ...catalogue(1), detail(), eligibility(false));
    renderRoute(`/games/${G.id}`);

    await user.click(await screen.findByRole("button", { name: "Play for Fun" }));
    const frame = await screen.findByTestId("game-frame");
    expect(frame).toHaveAttribute("srcdoc", '<div id="provider">Demo</div>');
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin"); // the fragment never reaches the skin's origin
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-popups-to-escape-sandbox"); // an escaped popup keeps its opener
    expect(bodies[0]).toMatchObject({ mode: "Demo", withBonus: false, currency: null, language: "en" });

    await user.click(screen.getByRole("button", { name: "Close game" }));
    expect(screen.queryByTestId("game-frame")).toBeNull();
  });

  it("real money with an eligible bonus asks first, and plays bonus-funded when chosen", async () => {
    const user = userEvent.setup();
    const bodies = launches((b) => HttpResponse.json(answer("Real", b.withBonus ? "bonus" : "real")));
    server.use(signedIn(), ...catalogue(1), detail(), eligibility(true));
    renderRoute(`/games/${G.id}`);

    await user.click(await screen.findByRole("button", { name: "Play for Real" }));
    const prompt = await screen.findByRole("dialog", { name: "Play with your bonus balance?" });
    expect(within(prompt).getByText(/Welcome Bonus can be used on this game/)).toBeInTheDocument();
    await user.click(within(prompt).getByRole("button", { name: "Play with bonus balance" }));

    await screen.findByTestId("game-frame");
    expect(bodies[0]).toMatchObject({ mode: "Real", withBonus: true, currency: "PHP" }); // real money: the skin's one currency
    expect(screen.getByRole("dialog", { name: "Playing Sweet Bonanza" })).toHaveTextContent("Bonus");
  });

  it("a refusal lands in the notice slot; Retry keeps the chosen mode; no pesos account offers the deposit", async () => {
    const user = userEvent.setup();
    let fail = "LAUNCH_PROVIDER_FAILED";
    const bodies = launches((b) => (fail ? problem(fail === "CURRENCY_NOT_HELD" ? 400 : 502, fail) : HttpResponse.json(answer(String(b.mode)))));
    server.use(signedIn(), ...catalogue(1), detail(), eligibility(false));
    renderRoute(`/games/${G.id}`);

    await user.click(await screen.findByRole("button", { name: "Play for Real" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("didn’t answer, so this session could not start. Your real-money mode choice is kept.");
    fail = "";
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByTestId("game-frame");
    expect(bodies.map((b) => b.mode)).toEqual(["Real", "Real"]);

    await user.click(screen.getByRole("button", { name: "Close game" }));
    fail = "CURRENCY_NOT_HELD";
    await user.click(screen.getByRole("button", { name: "Play for Real" }));
    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("Make a deposit to play for real money.");
    expect(within(notice).getByRole("link", { name: "Deposit" })).toHaveAttribute("href", "/wallet#deposit");
  });

  it("back from OUR sign-in (?play=real + the marker) the chosen mode opens by itself, exactly once", async () => {
    const bodies = launches(() => HttpResponse.json(answer("Real")));
    server.use(signedIn(), ...catalogue(1), detail(), eligibility(false));
    sessionStorage.setItem("chocho:playAfterSignIn", `${G.id}:real`);
    renderRoute(`/games/${G.id}?play=real`);

    await screen.findByTestId("game-frame");
    await new Promise((r) => setTimeout(r, 200)); // time for a second launch to show up if there were one
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ mode: "Real" });
    expect(sessionStorage.getItem("chocho:playAfterSignIn")).toBeNull();
  });

  it("a crafted ?play=real link opens nothing — a real-money session needs the player's own press", async () => {
    const bodies = launches(() => HttpResponse.json(answer("Real")));
    server.use(signedIn(), ...catalogue(1), detail(), eligibility(false));
    renderRoute(`/games/${G.id}?play=real`);
    const real = await screen.findByRole("button", { name: "Play for Real" });
    await waitFor(() => expect(real).toBeEnabled()); // eligibility answered — the moment an autoplay would fire
    await new Promise((r) => setTimeout(r, 200));
    expect(bodies).toHaveLength(0);
  });

  it("while bonus eligibility is unknown Real waits; when bonus cannot answer the player is asked anyway", async () => {
    const user = userEvent.setup();
    const bodies = launches((b) => HttpResponse.json(answer("Real", b.withBonus ? "bonus" : "real")));
    let answerEligibility: (() => void) | null = null;
    server.use(signedIn(), ...catalogue(1), detail(),
      http.get("*/api/bonus/launch-eligibility", () => new Promise<Response>((resolve) => { answerEligibility = () => resolve(problem(503, "UPSTREAM_UNAVAILABLE")); })));
    renderRoute(`/games/${G.id}`);

    const real = await screen.findByRole("button", { name: "Play for Real" });
    await waitFor(() => expect(answerEligibility).not.toBeNull());
    expect(real).toBeDisabled(); // no silent cash launch before bonus has answered
    answerEligibility!();
    await waitFor(() => expect(real).toBeEnabled());

    await user.click(real);
    const prompt = await screen.findByRole("dialog", { name: "Play with your bonus balance?" });
    expect(within(prompt).getByText(/couldn’t check whether your bonus can be used/)).toBeInTheDocument();
    await user.click(within(prompt).getByRole("button", { name: "Play with cash balance" }));
    await screen.findByTestId("game-frame");
    expect(bodies[0]).toMatchObject({ mode: "Real", withBonus: false });
  });

  it("a fragment that only frames the provider's URL is framed directly, keeping the provider's own origin", async () => {
    const user = userEvent.setup();
    launches(() => HttpResponse.json({ ...answer("Demo"), html: '<iframe src="https://games.provider.example/launch?t=1" width="100%" height="100%"></iframe>' }));
    server.use(signedIn(), ...catalogue(1), detail(), eligibility(false));
    renderRoute(`/games/${G.id}`);

    await user.click(await screen.findByRole("button", { name: "Play for Fun" }));
    const frame = await screen.findByTestId("game-frame");
    expect(frame).toHaveAttribute("src", "https://games.provider.example/launch?t=1");
    expect(frame).not.toHaveAttribute("srcdoc");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-popups-to-escape-sandbox");
  });

  it("no demo: Play for Fun is disabled with the design's line", async () => {
    server.use(...catalogue(1), detail({ hasDemo: false }));
    renderRoute(`/games/${G.id}`);
    expect(await screen.findByRole("button", { name: "Play for Fun" })).toBeDisabled();
    expect(screen.getByText(/Demo play is unavailable for this game right now/)).toBeInTheDocument();
  });
});
