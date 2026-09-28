import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { problem, server, signedIn } from "@/test/server";
import { fakeHub } from "@/test/fake-hub";
import { game } from "@/test/lobby-fixtures";

/** P3-29 — bonus's answers as the laptop seed makes them: the Weekend Reload and a free-rounds campaign. */
const RELOAD = {
  id: "0192b0a0-0000-7000-8000-000000000001", skinId: "chocho", name: "Weekend Reload", code: "CHOCHO-RELOAD", type: "reload", status: "active",
  description: null, sticky: false, wageringMultiplier: 20, startAt: null, endAt: "2026-10-05T15:59:00Z", maxUsesPerPlayer: 1, totalSteps: 1,
  steps: [{ id: "s1", stepNumber: 1, currency: "PHP", maxBonusAmountCents: 100_000, freeSpins: null, wageringMultiplier: null,
    intervals: [{ minDepositCents: 50_000, maxDepositCents: null, bonusPercent: 50, maxBonusCents: 100_000 }], freeSpinGameIds: [] }],
  allowedGameIds: [], gameContributions: [], minQualifyingStakeCents: null, maxQualifyingStakeCents: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
};
const EUR_ONLY = { ...RELOAD, id: "0192b0a0-0000-7000-8000-000000000002", name: "Euro Welcome", steps: [{ ...RELOAD.steps[0], currency: "EUR" }] };
const SPINS = {
  freeBetId: "0192b0a0-0000-7000-8000-0000000000f1", name: "Free Spins Drop", description: null, spinsPerGame: 25, betLevel: 1,
  gameIds: ["g-sweet"], startAt: "2026-01-01T00:00:00Z", expireAt: "2027-12-31T15:59:00Z", usesRemaining: 1,
};
const offered = (bonus: object, claimable = true, hasPendingActivation = false) => ({ bonus, hasPendingActivation, currentStepNumber: null, claimable });
const running = {
  bonusId: RELOAD.id, bonusName: "Weekend Reload", playerBonusId: "pb-1", status: "active", isInUse: true, hasPendingActivation: false,
  currentStepNumber: 1, totalSteps: 1, currency: "PHP", grantedCents: 50_000, wageringRequiredCents: 1_000_000, wageringCompletedCents: 250_000,
  wageringRemainingCents: 750_000, progressPercent: 25, grantedAt: "2026-09-28T00:00:00Z", expiresAt: "2026-10-12T15:59:00Z", closedAt: null, closeReason: null,
};
const awaiting = { ...running, playerBonusId: null, status: null, isInUse: false, hasPendingActivation: true, grantedCents: 0, wageringRequiredCents: 0, wageringCompletedCents: 0, wageringRemainingCents: 0, expiresAt: null };

function bonusApi({ catalog = [offered(RELOAD), offered(EUR_ONLY)], active = [] as object[], claimable = [SPINS], freebets = [] as object[] } = {}) {
  return [
    http.get("*/api/bonus", () => HttpResponse.json(catalog)),
    http.get("*/api/bonus/active", () => HttpResponse.json(active)),
    http.get("*/api/bonus/freebets", () => HttpResponse.json(freebets)),
    http.get("*/api/bonus/freebets/claimable", () => HttpResponse.json(claimable)),
    http.get("*/api/v1/games/:id", () => HttpResponse.json({ ...game(1), id: "g-sweet", name: "Sweet Bonanza", logoUrl: null, description: null, rtp: null, volatility: null })),
  ];
}

async function openBonusesTab() {
  const view = renderRoute("/account?tab=bonuses");
  await screen.findByRole("tab", { name: "Bonuses", selected: true });
  return view;
}

describe("My bonuses (P3-29)", () => {
  it("offers what bonus says is claimable in pesos, with the reward, deadline and terms built from the definition", async () => {
    const user = userEvent.setup();
    server.use(signedIn(), ...bonusApi());
    await openBonusesTab();

    const available = await screen.findByRole("region", { name: "Available to claim" });
    const reload = await within(available).findByRole("article", { name: "Weekend Reload" });
    expect(within(reload).getByText("50% deposit bonus, up to ₱1,000")).toBeInTheDocument();
    expect(within(reload).getByText(/^Claim by 5 Oct 2026/)).toBeInTheDocument();
    expect(within(reload).getByText("Deposit ₱500 or more. 20× wagering on the bonus amount before withdrawal.")).toBeInTheDocument();
    expect(within(available).queryByRole("article", { name: "Euro Welcome" })).toBeNull(); // no PHP step: nothing to earn here

    await user.click(within(reload).getByRole("button", { name: "View terms" }));
    const terms = within(reload).getByText("Bonus terms").parentElement!;
    expect(terms).toHaveTextContent("Deposits of ₱500 or more: 50% deposit bonus, up to ₱1,000.");
    expect(terms).toHaveTextContent("Wagering requirement: 20× the bonus amount.");
    expect(terms).toHaveTextContent("Only bets played with your bonus balance count towards wagering — cash bets don’t.");
    // Bonus counts COMPLETED uses only (old-engine parity), so the terms must not promise "one claim" (review F4).
    expect(terms).toHaveTextContent("Can be completed once per player.");
    expect(terms).toHaveTextContent("Withdrawing before the wagering is complete forfeits the bonus.");

    const spins = within(available).getByRole("article", { name: "Free Spins Drop" });
    expect(await within(spins).findByText("25 free spins on Sweet Bonanza")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Available to claim" })).getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Active bonuses" })).toHaveTextContent("You have no active bonuses.");
  });

  it("never claims on the first press: the terms box first, Confirm only once it is ticked — then bonus's answer", async () => {
    const user = userEvent.setup();
    let activated: unknown = null;
    let claimed = false;
    server.use(signedIn(),
      http.get("*/api/bonus", () => HttpResponse.json([offered(RELOAD, !claimed, claimed)])),
      http.get("*/api/bonus/active", () => HttpResponse.json(claimed ? [awaiting] : [])),
      http.post("*/api/bonus/activate", async ({ request }) => {
        activated = await request.json();
        claimed = true;
        return HttpResponse.json({ id: "a1", bonusId: RELOAD.id, activatedAt: "2026-09-28T00:00:00Z", consumedAt: null });
      }), ...bonusApi());
    await openBonusesTab();
    const reload = await screen.findByRole("article", { name: "Weekend Reload" });

    await user.click(within(reload).getByRole("button", { name: "Claim bonus" }));
    expect(activated).toBeNull();
    const box = within(reload).getByRole("checkbox", { name: "I have read and accept the terms of this bonus." });
    expect(box).not.toBeChecked();
    expect(within(reload).getByText("Bonus terms")).toBeInTheDocument(); // the terms open with the question
    const confirm = within(reload).getByRole("button", { name: "Confirm claim" });
    expect(confirm).toBeDisabled();

    await user.click(box);
    await user.click(confirm);
    await waitFor(() => expect(activated).toEqual({ bonusId: RELOAD.id, code: null }));

    // The list is re-read: the bonus left Available and is Active as AWAITING ACTIVATION, carrying the answer.
    const active = screen.getByRole("region", { name: "Active bonuses" });
    const card = await within(active).findByRole("article", { name: "Weekend Reload" });
    expect(within(card).getByText("Awaiting activation")).toBeInTheDocument();
    expect(within(card).getByText("Activates on your next deposit of ₱500 or more.")).toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent("Claimed. This bonus is added on your next qualifying deposit.");
    expect(within(screen.getByRole("region", { name: "Available to claim" })).queryByRole("article", { name: "Weekend Reload" })).toBeNull();
  });

  it.each([
    ["NOT_FOUND", 404, "This offer ended before the claim went through. It is no longer available."],
    ["BONUS_NOT_ELIGIBLE", 409, "This bonus was already used on your account."],
  ])("a %s refusal says so on the card and takes the claim away", async (code, status, copy) => {
    const user = userEvent.setup();
    server.use(signedIn(), ...bonusApi({ claimable: [] }), http.post("*/api/bonus/activate", () => problem(status, code)));
    await openBonusesTab();
    const reload = await screen.findByRole("article", { name: "Weekend Reload" });
    await user.click(within(reload).getByRole("button", { name: "Claim bonus" }));
    await user.click(within(reload).getByRole("checkbox"));
    await user.click(within(reload).getByRole("button", { name: "Confirm claim" }));

    expect(await within(reload).findByRole("status")).toHaveTextContent(copy);
    expect(within(reload).queryByRole("button", { name: /claim/i })).toBeNull();
  });

  it("a lost answer is not a refusal: it says it is checking, looks, and reports what bonus holds", async () => {
    const user = userEvent.setup();
    let landed = false;
    server.use(signedIn(),
      http.get("*/api/bonus/active", () => HttpResponse.json(landed ? [awaiting] : [])),
      http.post("*/api/bonus/activate", () => HttpResponse.error()), ...bonusApi({ claimable: [] }));
    await openBonusesTab();
    const reload = await screen.findByRole("article", { name: "Weekend Reload" });
    await user.click(within(reload).getByRole("button", { name: "Claim bonus" }));
    await user.click(within(reload).getByRole("checkbox"));
    await user.click(within(reload).getByRole("button", { name: "Confirm claim" }));

    // Not landed: an ordinary error, and the player may try again.
    expect(await within(reload).findByText("The claim didn’t go through. Please try again.")).toBeInTheDocument();
    expect(within(reload).getByRole("button", { name: "Confirm claim" })).toBeEnabled();

    // Landed (the activation went through, the answer did not): the Active card says it was claimed.
    landed = true;
    await user.click(within(reload).getByRole("button", { name: "Confirm claim" }));
    const card = await within(screen.getByRole("region", { name: "Active bonuses" })).findByRole("article", { name: "Weekend Reload" });
    expect(within(card).getByRole("status")).toHaveTextContent("Claimed.");
  });

  it("claims free rounds in pesos and shows the spins held, with a way into the game", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    let held = false;
    const holding = {
      playerFreeBetId: "pf-1", freeBetId: SPINS.freeBetId, name: "Free Spins Drop", source: "direct", status: "active", playerBonusId: null,
      totalCount: 25, remainingCount: 25, betLevel: 1, assigned: true, assignmentOutcome: "assigned", grantedAt: "2026-09-28T00:00:00Z", expiresAt: SPINS.expireAt, gameIds: ["g-sweet"],
    };
    server.use(signedIn(),
      http.get("*/api/bonus/freebets/claimable", () => HttpResponse.json(held ? [] : [SPINS])),
      http.get("*/api/bonus/freebets", () => HttpResponse.json(held ? [holding] : [])),
      http.post("*/api/bonus/freebets/claim", async ({ request }) => {
        body = await request.json();
        held = true;
        return HttpResponse.json(holding);
      }), ...bonusApi({ catalog: [] }));
    await openBonusesTab();
    const spins = await screen.findByRole("article", { name: "Free Spins Drop" });
    await user.click(within(spins).getByRole("button", { name: "Claim bonus" }));
    await user.click(within(spins).getByRole("checkbox"));
    await user.click(within(spins).getByRole("button", { name: "Confirm claim" }));

    await waitFor(() => expect(body).toEqual({ freeBetId: SPINS.freeBetId, currency: "PHP" }));
    const card = await within(screen.getByRole("region", { name: "Active bonuses" })).findByRole("article", { name: "Free Spins Drop" });
    expect(within(card).getByText("25 of 25 spins left")).toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent("Your free spins are in the game");
    expect(await within(card).findByRole("link", { name: "Play Sweet Bonanza" })).toHaveAttribute("href", "/games/g-sweet");
  });

  it("a running bonus shows its credit left (from the hub), its wagering progress and its expiry", async () => {
    server.use(signedIn(), ...bonusApi({ catalog: [offered(RELOAD, false)], claimable: [], active: [running] }));
    await openBonusesTab();
    await waitFor(() => expect(fakeHub.started).toBe(1));
    act(() => fakeHub.push([{ realCents: 100_000, bonusCents: 30_000, lockedCents: 2_000, activeBonusRef: "pb-1" }]));

    const card = await within(screen.getByRole("region", { name: "Active bonuses" })).findByRole("article", { name: "Weekend Reload" });
    expect(within(card).getByText("Active")).toBeInTheDocument();
    expect(within(card).getByText("₱500.00 bonus credit")).toBeInTheDocument();
    expect(within(card).getByText("₱320.00 of ₱500.00 bonus credit remaining")).toBeInTheDocument();
    expect(within(card).getByRole("progressbar", { name: "Wagering progress" })).toHaveAttribute("aria-valuenow", "25");
    expect(within(card).getByText("Wagering completed towards the 20× requirement: ₱2,500.00 of ₱10,000.00")).toBeInTheDocument();
    expect(within(card).getByText(/^Expires 12 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByTestId("bonus-balance")).toHaveTextContent("₱320.00");
  });

  it("re-reads bonus when the hub says the bonus funds moved (the deposit that grants the claim)", async () => {
    let reads = 0;
    server.use(signedIn(), http.get("*/api/bonus/active", () => {
      reads++;
      return HttpResponse.json([]);
    }), ...bonusApi());
    await openBonusesTab();
    await waitFor(() => expect(fakeHub.started).toBe(1));
    act(() => fakeHub.push([{ realCents: 100_000 }]));
    await waitFor(() => expect(reads).toBe(1));
    act(() => fakeHub.push([{ realCents: 90_000 }])); // a bet: nothing about bonuses moved
    act(() => fakeHub.push([{ realCents: 90_000, bonusCents: 50_000, activeBonusRef: "pb-1" }]));
    await waitFor(() => expect(reads).toBe(2));
  });

  it("an unreadable bonus service is the design's error, with Retry", async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(signedIn(), http.get("*/api/bonus/active", () => (fail ? problem(503, "UPSTREAM_UNAVAILABLE") : HttpResponse.json([]))), ...bonusApi());
    await openBonusesTab();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn’t load your bonuses. Please try again.");
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("region", { name: "Available to claim" })).toBeInTheDocument();
  });

  it("View my bonuses opens the same component in place, and closing hands focus back to the chevron", async () => {
    const user = userEvent.setup();
    server.use(signedIn(), ...bonusApi());
    renderRoute("/vip");
    await waitFor(() => expect(fakeHub.started).toBe(1));
    const chevron = screen.getByRole("button", { name: "Show balance details" });
    await user.click(chevron);
    await user.click(screen.getByRole("button", { name: "View my bonuses" }));

    const drawer = await screen.findByRole("dialog", { name: "My bonuses" });
    expect(await within(drawer).findByRole("article", { name: "Weekend Reload" })).toBeInTheDocument();
    expect(within(drawer).getAllByRole("heading", { name: "My bonuses" })).toHaveLength(1); // the drawer's title; the panel variant adds no page heading

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "My bonuses" })).toBeNull());
    expect(chevron).toHaveFocus();
  });

  describe("review fixes", () => {
    const holding = {
      playerFreeBetId: "pf-1", freeBetId: SPINS.freeBetId, name: "Free Spins Drop", source: "direct", status: "active", playerBonusId: null,
      totalCount: 25, remainingCount: 25, betLevel: 1, assigned: true, assignmentOutcome: "assigned", grantedAt: "2026-09-28T00:00:00Z", expiresAt: SPINS.expireAt, gameIds: ["g-sweet"],
    };

    it("F1/F2: the drawer closes when a card's link leaves the page, and does not survive sign-out", async () => {
      const user = userEvent.setup();
      server.use(signedIn(), ...bonusApi({ freebets: [holding] }));
      const { router, unmount } = renderRoute("/vip");
      await waitFor(() => expect(fakeHub.started).toBe(1));
      await user.click(screen.getByRole("button", { name: "Show balance details" }));
      await user.click(screen.getByRole("button", { name: "View my bonuses" }));
      const drawer = await screen.findByRole("dialog", { name: "My bonuses" });
      await user.click(await within(drawer).findByRole("link", { name: "Play Sweet Bonanza" }));
      await waitFor(() => expect(router.state.location.pathname).toBe("/games/g-sweet"));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "My bonuses" })).toBeNull());

      const { bonusDrawer } = await import("./bonus-drawer");
      act(() => bonusDrawer.open());
      unmount(); // sign-out unmounts the drawer with the session
      expect(bonusDrawer.get().open).toBe(false);
    });

    it("F5: a lost spins claim is not 'landed' just because an earlier claim of the same campaign is held", async () => {
      const user = userEvent.setup();
      server.use(signedIn(), http.post("*/api/bonus/freebets/claim", () => HttpResponse.error()),
        ...bonusApi({ catalog: [], claimable: [{ ...SPINS, usesRemaining: 1 }], freebets: [holding] }));
      await openBonusesTab();
      const offer = await within(await screen.findByRole("region", { name: "Available to claim" })).findByRole("article", { name: "Free Spins Drop" });
      await user.click(within(offer).getByRole("button", { name: "Claim bonus" }));
      await user.click(within(offer).getByRole("checkbox"));
      await user.click(within(offer).getByRole("button", { name: "Confirm claim" }));
      expect(await within(offer).findByText("The claim didn’t go through. Please try again.")).toBeInTheDocument();
    });

    it("F6: once the claimed bonus is granted, the 'added on your next deposit' answer does not follow it", async () => {
      const user = userEvent.setup();
      let stage: "offered" | "awaiting" | "running" = "offered";
      server.use(signedIn(),
        http.get("*/api/bonus", () => HttpResponse.json([offered(RELOAD, stage === "offered", stage === "awaiting")])),
        http.get("*/api/bonus/active", () => HttpResponse.json(stage === "offered" ? [] : stage === "awaiting" ? [awaiting] : [running])),
        http.post("*/api/bonus/activate", () => {
          stage = "awaiting";
          return HttpResponse.json({ id: "a1", bonusId: RELOAD.id, activatedAt: "2026-09-28T00:00:00Z", consumedAt: null });
        }), ...bonusApi({ claimable: [] }));
      await openBonusesTab();
      await waitFor(() => expect(fakeHub.started).toBe(1));
      act(() => fakeHub.push([{ realCents: 0 }]));
      const offer = await screen.findByRole("article", { name: "Weekend Reload" });
      await user.click(within(offer).getByRole("button", { name: "Claim bonus" }));
      await user.click(within(offer).getByRole("checkbox"));
      await user.click(within(offer).getByRole("button", { name: "Confirm claim" }));
      const active = screen.getByRole("region", { name: "Active bonuses" });
      expect(await within(active).findByText("Claimed. This bonus is added on your next qualifying deposit.")).toBeInTheDocument();

      stage = "running";
      act(() => fakeHub.push([{ realCents: 100_000, bonusCents: 50_000, activeBonusRef: "pb-1" }])); // the deposit granted it
      const card = await within(active).findByText("Active");
      expect(within(card.closest("article")!).queryByRole("status")).toBeNull();
    });

    it("F7: the tab follows the URL — a link to ?tab=bonuses switches it on the page", async () => {
      server.use(signedIn(), ...bonusApi());
      const { router } = renderRoute("/account");
      await screen.findByRole("tab", { name: "Profile", selected: true });
      await act(() => router.navigate({ to: "/account", search: { tab: "bonuses" } }));
      expect(await screen.findByRole("tab", { name: "Bonuses", selected: true })).toBeInTheDocument();
    });

    it("F8: an opt-in waiting behind a running bonus says so instead of promising the next deposit", async () => {
      const other = { ...running, bonusId: "other", bonusName: "Welcome Bonus", playerBonusId: "pb-9" };
      server.use(signedIn(), ...bonusApi({ catalog: [offered(RELOAD, false, true)], claimable: [], active: [other, awaiting] }));
      await openBonusesTab();
      const card = await within(await screen.findByRole("region", { name: "Active bonuses" })).findByRole("article", { name: "Weekend Reload" });
      expect(within(card).getByText("Activates on a qualifying deposit once your Welcome Bonus bonus ends.")).toBeInTheDocument();
    });
  });
});
