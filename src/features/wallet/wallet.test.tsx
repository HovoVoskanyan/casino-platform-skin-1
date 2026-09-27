import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { server, signedIn } from "@/test/server";
import { fakeHub } from "@/test/fake-hub";
import { balanceTiming } from "./balance-connection";

describe("the live balance (P3-28)", () => {
  it("shows — until core's first snapshot, then the total, and moves with every push", async () => {
    server.use(signedIn());
    renderRoute("/vip");
    const balance = await screen.findByTestId("header-balance");
    expect(balance).toHaveTextContent("—");
    await waitFor(() => expect(fakeHub.started).toBe(1));

    act(() => fakeHub.push([{ realCents: 948050, bonusCents: 250000, lockedCents: 50000, withdrawableCents: 900000 }]));
    expect(balance).toHaveTextContent("₱12,480.50"); // real + bonus + locked

    act(() => fakeHub.push([{ realCents: 1000 }]));
    expect(balance).toHaveTextContent("₱10.00");

    // A dropped connection is not a number: the design's — until the next snapshot.
    act(() => fakeHub.drop());
    expect(balance).toHaveTextContent("—");
  });

  it("a player with no account in pesos yet holds ₱0.00, not an unknown", async () => {
    server.use(signedIn());
    renderRoute("/vip");
    await waitFor(() => expect(fakeHub.started).toBe(1));
    act(() => fakeHub.push([]));
    expect(await screen.findByTestId("header-balance")).toHaveTextContent("₱0.00");
  });

  it("the details panel splits cash and bonus and counts the bonuses", async () => {
    const user = userEvent.setup();
    server.use(signedIn(),
      http.get("*/api/bonus", () => HttpResponse.json([{ bonus: {}, hasPendingActivation: false }, { bonus: {}, hasPendingActivation: false }, { bonus: {}, hasPendingActivation: true }])),
      http.get("*/api/bonus/active", () => HttpResponse.json([{ status: "active" }, { status: "completed" }])));
    renderRoute("/vip");
    await waitFor(() => expect(fakeHub.started).toBe(1));
    act(() => fakeHub.push([{ realCents: 948050, bonusCents: 300000 }]));

    await user.click(screen.getByRole("button", { name: "Show balance details" }));
    const panel = screen.getByRole("dialog", { name: "Balance details" });
    expect(within(panel).getByText("Cash balance").nextSibling).toHaveTextContent("₱9,480.50");
    expect(within(panel).getByText("Bonus balance").nextSibling).toHaveTextContent("₱3,000.00");
    await waitFor(() => expect(within(panel).getByText("Available to claim").nextSibling).toHaveTextContent("2"));
    expect(within(panel).getByText("Active bonuses").nextSibling).toHaveTextContent("1");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Balance details" })).toBeNull();
  });

  it("Hide balance on the Wallet hides it in the header too — one setting", async () => {
    const user = userEvent.setup();
    server.use(signedIn());
    renderRoute("/wallet");
    await waitFor(() => expect(fakeHub.started).toBe(1));
    act(() => fakeHub.push([{ realCents: 948050, bonusCents: 300000, withdrawableCents: 900000 }]));

    expect(await screen.findByTestId("wallet-total")).toHaveTextContent("₱12,480.50");
    expect(screen.getByText("Available to withdraw").nextSibling).toHaveTextContent("₱9,000.00");
    expect(screen.getByText("Bonus funds").nextSibling).toHaveTextContent("₱3,000.00");

    await user.click(screen.getByRole("button", { name: "Hide balance" }));
    expect(screen.getByTestId("wallet-total")).toHaveTextContent("••••••");
    expect(screen.getByTestId("header-balance")).toHaveTextContent("••••••");
    expect(screen.queryByText("Available to withdraw")).toBeNull();
    expect(localStorage.getItem("chocho:balanceHidden")).toBe("1");
  });

  it("a guest opens no hub connection", async () => {
    renderRoute("/vip");
    await screen.findByRole("button", { name: "Sign in" });
    expect(fakeHub.started).toBe(0);
  });

  it("a refused negotiate (401) refreshes the session ONCE and connects again", async () => {
    const refresh = vi.fn();
    server.use(signedIn(), http.post("*/api/id/auth/refresh", () => { refresh(); return new HttpResponse(null, { status: 200 }); }));
    fakeHub.failNextStarts = [new Error("Failed to complete negotiation with the server: Status code '401'")];
    renderRoute("/vip");

    await waitFor(() => expect(fakeHub.started).toBe(2));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => fakeHub.push([{ realCents: 500 }]));
    expect(screen.getByTestId("header-balance")).toHaveTextContent("₱5.00");
  });

  it("any other failure retries WITHOUT a refresh — refreshing on every failure races other tabs into reuse detection", async () => {
    const refresh = vi.fn();
    server.use(signedIn(), http.post("*/api/id/auth/refresh", () => { refresh(); return new HttpResponse(null, { status: 200 }); }));
    fakeHub.failNextStarts = [new Error("Failed to complete negotiation with the server: Status code '502'")];
    renderRoute("/vip");

    await waitFor(() => expect(fakeHub.started).toBe(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("header-balance")).toHaveTextContent("—");
  });

  it("a refresh that fails is the end of the session: the app says so and offers sign-in", async () => {
    server.use(signedIn(), http.post("*/api/id/auth/refresh", () => new HttpResponse(null, { status: 401 })));
    fakeHub.failNextStarts = [new Error("Status code '401'")];
    renderRoute("/vip");

    expect(await screen.findByText("Welcome back to ChoCho")).toBeInTheDocument();
    expect(fakeHub.started).toBe(1); // and the loop stopped
  });

  it("connected but no snapshot (core could not read the wallet) → the design's wallet error, not a skeleton forever", async () => {
    balanceTiming.snapshotTimeoutMs = 50;
    try {
      server.use(signedIn());
      renderRoute("/wallet");
      expect(await screen.findByText("We couldn’t load your wallet. Please try again.")).toBeInTheDocument();
      expect(fakeHub.stopped).toBeGreaterThan(0);
    } finally {
      balanceTiming.snapshotTimeoutMs = 10_000;
    }
  });
});
