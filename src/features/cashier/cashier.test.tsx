import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { problem, server, signedIn } from "@/test/server";
import { fakeHub } from "@/test/fake-hub";
import { toReceiver } from "./withdraw-dialog";
import { feeOf, pollEvery, type Payment } from "./api";

const GCASH = { methodId: "11111111-1111-7111-8111-00000000c0a1", name: "GCash", currency: "PHP", logoUrl: null, minAmountCents: 10_000, maxAmountCents: 5_000_000, feeType: "fix", fee: 0, sortOrder: 0 };
const MAYA = { ...GCASH, methodId: "11111111-1111-7111-8111-00000000c0a2", name: "Maya", sortOrder: 1 };
const EUR = { ...GCASH, methodId: "11111111-1111-7111-8111-0000000000e0", name: "Stub EUR", currency: "EUR" };
const payment = (over: object = {}) => ({
  id: "01a0e4c4-b012-751a-ad2d-a37bd7edc00c", type: "deposit", status: "pending", currency: "PHP", amountCents: 100_000, playerFeeCents: 0,
  methodId: GCASH.methodId, provider: "stub", paymentUrl: "https://psp.example/pay/1", paymentQr: null, receiver: null, failureCode: null,
  createdAt: "2026-09-28T01:28:00Z", completedAt: null, ...over,
});
const methods = () => [
  http.get("*/api/payments/methods/deposit", () => HttpResponse.json([MAYA, EUR, GCASH])),
  http.get("*/api/payments/methods/withdraw", () => HttpResponse.json([GCASH, MAYA])),
];
/** The balance core would push — once the page's hub connection is up (it starts a tick after mount). */
async function live(account: object) {
  await waitFor(() => expect(fakeHub.started).toBeGreaterThan(0));
  act(() => fakeHub.push([account]));
}

describe("the cashier (P3-28)", () => {
  it("#deposit opens the deposit: the skin's own currency's methods, the range, then where to pay and the outcome", async () => {
    const user = userEvent.setup();
    let status = "pending";
    const created: unknown[] = [];
    server.use(signedIn(), ...methods(),
      http.post("*/api/payments/deposits", async ({ request }) => { created.push(await request.json()); return HttpResponse.json(payment()); }),
      // Made just now (P3-29: a fixed createdAt aged past pollEvery's 15-minute window and the fast poll stopped).
      http.get("*/api/payments/history", () => HttpResponse.json(created.length ? [payment({ status, createdAt: new Date().toISOString() })] : [])));
    renderRoute("/wallet#deposit");

    const dialog = await screen.findByRole("dialog", { name: "Add money to your wallet" });
    const radios = await within(dialog).findAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["GCashE-wallet", "MayaE-wallet"]); // sorted; EUR is another market's
    expect(within(dialog).getByText("Min ₱100.00 · Max ₱50,000.00")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Amount"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Continue to GCash" }));
    expect(within(dialog).getByText("Enter an amount between ₱100.00 and ₱50,000.00.")).toBeInTheDocument();
    expect(created).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "₱1,000" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue to GCash" }));
    await waitFor(() => expect(created).toEqual([{ methodId: GCASH.methodId, currency: "PHP", amountCents: 100_000 }]));

    const progress = await screen.findByRole("dialog", { name: "Your GCash deposit" });
    expect(within(progress).getByRole("link", { name: "Open GCash" })).toHaveAttribute("href", "https://psp.example/pay/1");
    expect(within(progress).getByText("Pending")).toBeInTheDocument();

    // The PSP calls payments back; the history the dialog watches says so — no reload.
    status = "completed";
    expect(await within(progress).findByText("₱1,000.00 has been added to your wallet.", undefined, { timeout: 6_000 })).toBeInTheDocument();
  }, 10_000);

  it("a deposit payments refuses keeps the form, with the reason", async () => {
    const user = userEvent.setup();
    server.use(signedIn(), ...methods(), http.post("*/api/payments/deposits", () => problem(403, "PLAYER_RESTRICTED")));
    renderRoute("/wallet#deposit");
    const dialog = await screen.findByRole("dialog", { name: "Add money to your wallet" });
    await user.type(await within(dialog).findByLabelText("Amount"), "500");
    await user.click(within(dialog).getByRole("button", { name: "Continue to GCash" }));
    expect(await within(dialog).findByText(/Payments are paused on this account/)).toBeInTheDocument();
  });

  it("a withdrawal is quoted first: the server's notice always, its refusal as it words it", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn();
    server.use(signedIn(), ...methods(),
      http.post("*/api/payments/withdrawals/quote", () => HttpResponse.json({ allowed: false, refusalCode: "TURNOVER_NOT_MET", refusalMessage: "Withdrawal is not allowed until the wagering requirement on your deposits is met.", amountCents: 20_000, feeCents: 0, bonusForfeit: null, forfeitNotice: "Any bonus that is active when this withdrawal is paid out is forfeited." })),
      http.post("*/api/payments/withdrawals", () => { submitted(); return HttpResponse.json(payment()); }));
    renderRoute("/wallet");
    await live({ realCents: 60_000, withdrawableCents: 60_000 });
    await user.click(await screen.findByRole("button", { name: "Withdraw" }));

    const dialog = await screen.findByRole("dialog", { name: "Withdraw to your e-wallet" });
    expect(await within(dialog).findByText("Available to withdraw: ₱600.00")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Amount"), "700");
    await user.type(within(dialog).getByLabelText("Your GCash number"), "917123");
    await user.click(within(dialog).getByRole("button", { name: "Review withdrawal" }));
    expect(within(dialog).getByText("That’s more than you can withdraw right now (₱600.00).")).toBeInTheDocument();
    expect(within(dialog).getByText(/Enter the 10 digits of your GCash mobile number/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Amount"));
    await user.type(within(dialog).getByLabelText("Amount"), "200");
    await user.clear(within(dialog).getByLabelText("Your GCash number"));
    await user.type(within(dialog).getByLabelText("Your GCash number"), "917 123 4567");
    await user.click(within(dialog).getByRole("button", { name: "Review withdrawal" }));

    const review = await screen.findByRole("dialog", { name: "Review your withdrawal" });
    expect(within(review).getByRole("note")).toHaveTextContent("Any bonus that is active when this withdrawal is paid out is forfeited.");
    expect(within(review).getByText("Withdrawal is not allowed until the wagering requirement on your deposits is met.")).toBeInTheDocument();
    expect(within(review).queryByRole("button", { name: "Confirm withdrawal" })).toBeNull();
    expect(submitted).not.toHaveBeenCalled();
  });

  it("a bonus at stake must be acknowledged before Confirm; the e-wallet gets the national number", async () => {
    const user = userEvent.setup();
    const bodies: Record<string, unknown>[] = [];
    server.use(signedIn(), ...methods(),
      http.post("*/api/payments/withdrawals/quote", () => HttpResponse.json({ allowed: true, refusalCode: null, refusalMessage: null, amountCents: 20_000, feeCents: 500, bonusForfeit: { playerBonusId: "b1", bonusCents: 100_000, lockedCents: 25_050, totalCents: 125_050 }, forfeitNotice: "Your active bonus will be forfeited." })),
      http.post("*/api/payments/withdrawals", async ({ request }) => { bodies.push((await request.json()) as Record<string, unknown>); return HttpResponse.json(payment({ type: "withdrawal", amountCents: 20_000, receiver: "09171234567" })); }));
    renderRoute("/wallet#withdraw");
    await live({ realCents: 60_000, withdrawableCents: 60_000 });

    const dialog = await screen.findByRole("dialog", { name: "Withdraw to your e-wallet" });
    await user.type(await within(dialog).findByLabelText("Amount"), "200");
    await user.type(within(dialog).getByLabelText("Your GCash number"), "9171234567");
    await user.click(within(dialog).getByRole("button", { name: "Review withdrawal" }));

    const review = await screen.findByRole("dialog", { name: "Review your withdrawal" });
    // The fee is disclosed, never netted: payments pays out the full amount (review B1).
    expect(within(review).getByText("Paid out to you").nextSibling).toHaveTextContent("₱200.00");
    expect(within(review).getByText("Method fee (listed)").nextSibling).toHaveTextContent("₱5.00");
    expect(within(review).queryByText("₱195.00")).toBeNull();
    const confirm = within(review).getByRole("button", { name: "Confirm withdrawal" });
    expect(confirm).toBeDisabled();
    await user.click(within(review).getByRole("checkbox", { name: /forfeits my bonus funds of ₱1,250.50/ }));
    await user.click(confirm);

    expect(await screen.findByRole("dialog", { name: "Withdrawal requested" })).toHaveTextContent("Pending");
    expect(bodies[0]).toEqual({ methodId: GCASH.methodId, currency: "PHP", amountCents: 20_000, receiver: "09171234567", acknowledgeBonusForfeit: true });
  });

  it("recent transactions: the design's rows and chips, filters, and the detail dialog", async () => {
    const user = userEvent.setup();
    const rows = [
      payment({ id: "a0000000-0000-7000-8000-000000000001", type: "withdrawal", status: "processing", amountCents: 120_000, receiver: "09171234567" }),
      payment({ id: "a0000000-0000-7000-8000-000000000002", status: "completed" }),
      payment({ id: "a0000000-0000-7000-8000-000000000003", status: "failed" }),
      payment({ id: "a0000000-0000-7000-8000-000000000004", type: "withdrawal", status: "rejected" }),
    ];
    const asked: (string | null)[] = [];
    server.use(signedIn(), ...methods(), http.get("*/api/payments/history", ({ request }) => {
      const type = new URL(request.url).searchParams.get("type");
      asked.push(type);
      return HttpResponse.json(rows.filter((r) => !type || r.type === type));
    }));
    renderRoute("/wallet");

    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByText("−₱1,200.00")).toBeInTheDocument();
    expect(within(list).getAllByText("+₱1,000.00")).toHaveLength(2);
    for (const chip of ["Pending", "Completed", "Failed", "Cancelled"]) expect(within(list).getByText(chip)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Withdrawals" }));
    await waitFor(() => expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2));
    expect(asked).toContain("withdrawal");

    await user.click(within(screen.getByRole("list")).getAllByRole("button", { name: "View details" })[0]!);
    const detail = await screen.findByRole("dialog", { name: "Withdrawal" });
    expect(within(detail).getByText("GCash · 09171234567")).toBeInTheDocument();
    expect(within(detail).getByText("A0000000-0000-7000-8000-000000000001")).toBeInTheDocument();
    expect(within(detail).getByText(/with our payments team/)).toBeInTheDocument();
  });

  it("no payments yet reads as the design's empty state", async () => {
    server.use(signedIn(), ...methods());
    renderRoute("/wallet");
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
  });
});

describe("cashier rules (P3-28 review)", () => {
  it("the e-wallet number, however a Filipino writes it, reaches the PSP as 09XXXXXXXXX", () => {
    for (const typed of ["9171234567", "917 123 4567", "0917-123-4567", "639171234567", "+63 917 123 4567", "(0917) 123.4567"]) {
      expect(toReceiver(typed)).toBe("09171234567");
    }
    for (const bad of ["917123456", "8171234567", "+1 917 123 4567", ""]) expect(toReceiver(bad)).toBeNull();
  });

  it("a fee is payments' schedule: fix cents or hundredths of a percent, never more than the amount", () => {
    expect(feeOf({ ...GCASH, feeType: "fix", fee: 500 }, 100_000)).toBe(500);
    expect(feeOf({ ...GCASH, feeType: "percent", fee: 250 }, 100_000)).toBe(2_500);
    expect(feeOf({ ...GCASH, feeType: "fix", fee: 5_000 }, 1_000)).toBe(1_000);
    expect(feeOf({ ...GCASH, fee: 0 }, 100_000)).toBe(0);
  });

  it("the history is re-read fast only for a payment the player is waiting on now; slowly for an old open one; never for none", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    const row = (status: string, minutesAgo: number) => payment({ status, createdAt: new Date(now - minutesAgo * 60_000).toISOString() }) as Payment;
    expect(pollEvery([row("pending", 2)], now)).toBe(4_000);
    expect(pollEvery([row("pending", 180)], now)).toBe(60_000);
    expect(pollEvery([row("completed", 1), row("rejected", 1)], now)).toBe(false);
  });
});
