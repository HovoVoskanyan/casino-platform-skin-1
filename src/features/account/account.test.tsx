import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { ACCOUNT, problem, server, signedIn } from "@/test/server";

const account = (over: Partial<typeof ACCOUNT> = {}) => http.get("*/api/id/auth/account", () => HttpResponse.json({ ...ACCOUNT, ...over }));
const profile = { displayName: null, city: null, playerNumber: 4820117 };

describe("My Account (P3-24)", () => {
  it("Profile shows the player id the design's way and saves the display name and city", async () => {
    const user = userEvent.setup();
    let saved: unknown = null;
    server.use(signedIn(), account(),
      http.get("*/api/v1/me/profile", () => HttpResponse.json(profile)),
      http.put("*/api/v1/me/profile", async ({ request }) => { saved = await request.json(); return HttpResponse.json({ ...profile, displayName: "Juan dC", city: "Cebu" }); }));
    renderRoute("/account");

    expect(await screen.findByText("CHO-4 820 117")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Display name"), "Jo");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText(/Use 3–20 characters/)).toBeInTheDocument();
    expect(saved).toBeNull();

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Juan dC");
    await user.type(screen.getByLabelText("City"), "Cebu");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(saved).toEqual({ displayName: "Juan dC", city: "Cebu" }));
  });

  it("a phone account adds an email: pending until confirmed, with resend and cancel", async () => {
    const user = userEvent.setup();
    let pendingEmail: string | null = null;
    let started: Record<string, unknown> | null = null;
    const cancelled = vi.fn();
    server.use(signedIn(),
      http.get("*/api/id/auth/account", () => HttpResponse.json({ ...ACCOUNT, email: null, emailVerified: false, phone: "+639171234567", phoneVerified: true, pendingEmail })),
      http.post("*/api/id/auth/account/email", async ({ request }) => { started = (await request.json()) as Record<string, unknown>; pendingEmail = "new@example.test"; return new HttpResponse(null, { status: 202 }); }),
      http.delete("*/api/id/auth/account/email/pending", () => { cancelled(); pendingEmail = null; return new HttpResponse(null, { status: 204 }); }));
    renderRoute("/account");

    await user.click(await screen.findByRole("tab", { name: "Security" }));
    const contacts = (await screen.findByRole("heading", { name: "Contact details" })).closest("section")!;
    expect(within(contacts).getByText("Not added")).toBeInTheDocument();
    expect(within(contacts).getByText("+639171234567")).toBeInTheDocument();

    await user.click(within(contacts).getByRole("button", { name: "Add" }));
    await user.type(within(contacts).getByLabelText("New email address"), "new@example.test");
    await user.click(within(contacts).getByRole("button", { name: "Send confirmation link" }));
    expect(await within(contacts).findByText("Enter your password.")).toBeInTheDocument(); // the account has a password: it is asked
    await user.type(within(contacts).getByLabelText("Current password"), "Passw0rd!2345");
    await user.click(within(contacts).getByRole("button", { name: "Send confirmation link" }));

    await waitFor(() => expect(started).toMatchObject({ email: "new@example.test", password: "Passw0rd!2345", verifyUrl: expect.stringMatching(/\/verify-email$/) }));
    expect(await within(contacts).findByText("CHANGE PENDING")).toBeInTheDocument();
    await user.click(within(contacts).getByRole("button", { name: "Cancel change" }));
    await waitFor(() => expect(cancelled).toHaveBeenCalled());
    await waitFor(() => expect(within(contacts).queryByText("CHANGE PENDING")).toBeNull());
  });

  it("a Telegram-only account cannot disconnect it until a password is set", async () => {
    const user = userEvent.setup();
    let hasPassword = false;
    server.use(signedIn(),
      http.get("*/api/id/auth/account", () => HttpResponse.json({ ...ACCOUNT, email: null, hasPassword, linkedProviders: ["telegram"] })),
      http.post("*/api/id/auth/account/password", () => { hasPassword = true; return new HttpResponse(null, { status: 204 }); }));
    renderRoute("/account");
    await user.click(await screen.findByRole("tab", { name: "Security" }));

    const methods = (await screen.findByRole("heading", { name: "Connected login methods" })).closest("section")!;
    expect(within(methods).getByRole("button", { name: "Disconnect" })).toBeDisabled();
    expect(within(methods).getByText(/only way to sign in/)).toBeInTheDocument();

    await user.type(within(methods).getByLabelText("New password"), "First-pass-1");
    await user.type(within(methods).getByLabelText("Confirm new password"), "First-pass-1");
    await user.click(within(methods).getByRole("button", { name: "Set password" }));
    // P3-24 review S2: a password with no email or number to sign in and reset with is not a way in yet.
    await waitFor(() => expect(within(methods).getByText("Set")).toBeInTheDocument());
    expect(within(methods).getByRole("button", { name: "Disconnect" })).toBeDisabled();
    expect(within(methods).getByText(/Add an email or mobile number/)).toBeInTheDocument();
  });

  it("with a password and a number, Telegram can go — and the card says what to sign in with", async () => {
    const user = userEvent.setup();
    const unlinked = vi.fn();
    server.use(signedIn(),
      http.get("*/api/id/auth/account", () => HttpResponse.json({ ...ACCOUNT, email: null, phone: "+639171234567", phoneVerified: true, linkedProviders: ["telegram"] })),
      http.post("*/api/id/auth/telegram/unlink", () => { unlinked(); return new HttpResponse(null, { status: 204 }); }));
    renderRoute("/account");
    await user.click(await screen.findByRole("tab", { name: "Security" }));
    const methods = (await screen.findByRole("heading", { name: "Connected login methods" })).closest("section")!;

    expect(within(methods).getByText("Set · sign in with +639171234567")).toBeInTheDocument();
    await user.click(within(methods).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(unlinked).toHaveBeenCalled());
  });

  it("a number the sign-up never confirmed can be verified later (Later was not forever)", async () => {
    const user = userEvent.setup();
    let phoneVerified = false;
    const resent = vi.fn();
    const verified = vi.fn();
    server.use(signedIn(),
      http.get("*/api/id/auth/account", () => HttpResponse.json({ ...ACCOUNT, email: null, phone: "+639171234567", phoneVerified })),
      http.post("*/api/id/auth/resend-phone-verification", async ({ request }) => { resent(await request.json()); return new HttpResponse(null, { status: 202 }); }),
      http.post("*/api/id/auth/verify-phone", async ({ request }) => { verified(await request.json()); phoneVerified = true; return new HttpResponse(null, { status: 204 }); }));
    renderRoute("/account");
    await user.click(await screen.findByRole("tab", { name: "Security" }));
    const contacts = (await screen.findByRole("heading", { name: "Contact details" })).closest("section")!;

    expect(within(contacts).getByText("Not verified")).toBeInTheDocument();
    await user.click(within(contacts).getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(resent).toHaveBeenCalledWith({ phone: "+639171234567" }));
    await user.type(await within(contacts).findByLabelText("Verification code"), "246810");
    await user.click(within(contacts).getByRole("button", { name: "Confirm number" }));
    await waitFor(() => expect(verified).toHaveBeenCalledWith({ phone: "+639171234567", code: "246810" }));
    expect(await within(contacts).findByText("Verified")).toBeInTheDocument();
  });

  it("a detail another account holds reads as My Account's own error, not the sign-up's", async () => {
    const user = userEvent.setup();
    server.use(signedIn(), account(),
      http.post("*/api/id/auth/account/phone", () => problem(409, "CONTACT_IN_USE")));
    renderRoute("/account");
    await user.click(await screen.findByRole("tab", { name: "Security" }));
    const contacts = (await screen.findByRole("heading", { name: "Contact details" })).closest("section")!;

    await user.click(within(contacts).getByRole("button", { name: "Add" }));
    await user.type(within(contacts).getByLabelText("New mobile number"), "9171234567");
    await user.type(within(contacts).getByLabelText("Current password"), "Passw0rd!2345");
    await user.click(within(contacts).getByRole("button", { name: "Send code" }));
    expect(await within(contacts).findByText("Another account already uses this. Use a different one.")).toBeInTheDocument();
    expect(within(contacts).queryByText(/Sign in/)).toBeNull();
  });

  it("a player with no consent on record is asked once, over the page", async () => {
    const user = userEvent.setup();
    let confirmed = false;
    server.use(signedIn(),
      http.get("*/api/id/auth/account", () => HttpResponse.json({ ...ACCOUNT, ageConfirmed: confirmed })),
      http.post("*/api/id/auth/account/confirm-age", () => { confirmed = true; return new HttpResponse(null, { status: 204 }); }));
    renderRoute("/account");

    const dialog = await screen.findByRole("dialog", { name: "One more step" });
    expect(within(dialog).getByText(/legal age to play/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "I confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "One more step" })).toBeNull());
  });

  it("the email-change link lands on /verify-email?change=1 and confirms the change", async () => {
    const confirm = vi.fn();
    server.use(http.post("*/api/id/auth/confirm-email-change", async ({ request }) => { confirm(await request.json()); return new HttpResponse(null, { status: 204 }); }),
      http.post("*/api/id/auth/verify-email", () => problem(400, "INVALID_EMAIL_OR_TOKEN")));
    renderRoute("/verify-email?email=new%40example.test&token=abc&change=1");
    expect(await screen.findByText("Your new email address is confirmed.")).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledWith({ email: "new@example.test", token: "abc" });
  });
});
