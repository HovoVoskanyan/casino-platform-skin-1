import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/render";
import { server, problem, cookieSession } from "@/test/server";
import { AuthDialog } from "./auth-dialog";
import { authDialog } from "./auth-dialog-state";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

describe("the shared auth dialog", () => {
  afterEach(() => authDialog.close());

  it("opens in the mode the hash names and validates before asking the server", async () => {
    const user = userEvent.setup();
    const signin = vi.fn();
    server.use(http.post("*/api/id/auth/signin", () => { signin(); return cookieSession(); }));
    renderWithProviders(<AuthDialog />);
    authDialog.open("signin");

    expect(await screen.findByRole("dialog")).toHaveTextContent("Welcome back to ChoCho");
    await user.click(screen.getByRole("tab", { name: "Email" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(signin).not.toHaveBeenCalled();
  });

  it("shows identity's answer for wrong credentials as the design's inline error", async () => {
    const user = userEvent.setup();
    server.use(http.post("*/api/id/auth/signin", () => problem(401, "INVALID_CREDENTIALS")));
    renderWithProviders(<AuthDialog />);
    authDialog.open("signin");
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("tab", { name: "Email" }));
    await user.type(screen.getByLabelText("Email address"), "p@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong-pass-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("don’t match an account");
  });

  it("switches to the two-factor step when identity says TOTP_REQUIRED, then signs in with the code", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(http.post("*/api/id/auth/signin", async ({ request }) => {
      const body = (await request.json()) as { totpCode: string | null };
      bodies.push(body);
      return body.totpCode ? cookieSession() : problem(401, "TOTP_REQUIRED");
    }));
    renderWithProviders(<AuthDialog />);
    authDialog.open("signin");
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("tab", { name: "Email" }));
    await user.type(screen.getByLabelText("Email address"), "p@example.test");
    await user.type(screen.getByLabelText("Password"), "right-pass-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Two-factor code")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ emailOrUsername: "p@example.test", totpCode: "123456" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("registers with the consent box ticked, this skin's verify URL, and the captured attribution", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("chocho.attribution", JSON.stringify({ affiliate: "aff-42", source: "promo" }));
    let seen: { body: unknown; headers: Record<string, string> } | null = null;
    server.use(http.post("*/api/id/auth/signup", async ({ request }) => {
      seen = { body: await request.json(), headers: Object.fromEntries(request.headers.entries()) };
      return cookieSession();
    }));
    renderWithProviders(<AuthDialog />);
    authDialog.open("register");
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("tab", { name: "Email" }));
    await user.type(screen.getByLabelText("Email address"), "new@example.test");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!2345");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Please confirm you are of legal age and accept the Terms & Conditions and Privacy Policy to continue.")).toBeInTheDocument();
    expect(seen).toBeNull();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(seen).not.toBeNull());
    // The one checkbox is the legal-age consent identity requires (owner 2026-09-27: a consent, never a DOB).
    expect(seen!.body).toMatchObject({ email: "new@example.test", phone: null, username: null, ageConfirmed: true, verifyUrl: expect.stringMatching(/\/verify-email$/) });
    expect(seen!.headers.externaldatakey).toBe("aff-42");
    expect(seen!.headers["x-source"]).toBe("promo");
  });

  it("the reset flow asks for the email, then the code and a new password", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    server.use(
      http.post("*/api/id/auth/forgot-password", () => new HttpResponse(null, { status: 202 })),
      http.post("*/api/id/auth/reset-password", async ({ request }) => { reset(await request.json()); return new HttpResponse(null, { status: 204 }); }),
    );
    renderWithProviders(<AuthDialog />);
    authDialog.open("reset");
    await screen.findByRole("dialog");

    // Email only: the phone route texts its code and there is no SMS provider, so the reset offers no Phone tab.
    expect(screen.queryByRole("tab")).toBeNull();
    await user.type(screen.getByLabelText("Email address"), "p@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));

    expect(await screen.findByText("Enter your reset code")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reset code"), "654321");
    await user.type(screen.getByLabelText("New password"), "Passw0rd!2345");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() => expect(reset).toHaveBeenCalledWith({ email: "p@example.test", phone: null, otp: "654321", newPassword: "Passw0rd!2345" }));
    expect(await screen.findByText("Welcome back to ChoCho")).toBeInTheDocument();
  });

  it("registration opens on Email, sign-in on Phone (owner 2026-10-20)", async () => {
    renderWithProviders(<AuthDialog />);
    authDialog.open("register");
    await screen.findByRole("dialog");
    expect(screen.getByRole("tab", { name: "Email" })).toHaveAttribute("aria-selected", "true");
    act(() => authDialog.open("signin"));
    expect(await screen.findByRole("tab", { name: "Phone" })).toHaveAttribute("aria-selected", "true");
  });

  it("registers by phone and finishes signed in — no SMS code step", async () => {
    const user = userEvent.setup();
    let signup: Record<string, unknown> | null = null;
    const verify = vi.fn();
    server.use(
      http.post("*/api/id/auth/signup", async ({ request }) => { signup = (await request.json()) as Record<string, unknown>; return cookieSession(); }),
      http.post("*/api/id/auth/verify-phone", () => { verify(); return new HttpResponse(null, { status: 204 }); }),
      http.post("*/api/id/auth/resend-phone-verification", () => { verify(); return new HttpResponse(null, { status: 202 }); }),
    );
    renderWithProviders(<AuthDialog />);
    authDialog.open("register");
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("tab", { name: "Phone" }));
    await user.type(screen.getByLabelText("Mobile number"), "0917");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!2345");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter the 10 digits of a PH mobile number, starting with 9.")).toBeInTheDocument();
    expect(signup).toBeNull();

    await user.clear(screen.getByLabelText("Mobile number"));
    await user.type(screen.getByLabelText("Mobile number"), "917 123 4567");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(signup).not.toBeNull());
    expect(signup).toMatchObject({ phone: "+639171234567", email: null, verifyUrl: null, ageConfirmed: true });

    // Straight out of the dialog: no "Confirm your number", no code field, nothing sent to the verify endpoints.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Confirm your number")).toBeNull();
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("signs in by phone in E.164; a forgotten password is reset by email", async () => {
    const user = userEvent.setup();
    const signins: unknown[] = [];
    const forgot = vi.fn();
    server.use(
      http.post("*/api/id/auth/signin", async ({ request }) => { signins.push(await request.json()); return problem(401, "INVALID_CREDENTIALS"); }),
      http.post("*/api/id/auth/forgot-password", async ({ request }) => { forgot(await request.json()); return new HttpResponse(null, { status: 202 }); }),
    );
    renderWithProviders(<AuthDialog />);
    authDialog.open("signin");
    await screen.findByRole("dialog");

    await user.type(screen.getByLabelText("Mobile number"), "9171234567");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!2345");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(signins).toHaveLength(1));
    expect(signins[0]).toMatchObject({ emailOrUsername: "+639171234567" });

    // Forgot from the Phone tab still lands on the email reset.
    await user.click(screen.getByRole("button", { name: /Forgot/ }));
    await user.type(await screen.findByLabelText("Email address"), "p@example.test");
    expect(screen.queryByLabelText("Mobile number")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Send reset code" }));
    await waitFor(() => expect(forgot).toHaveBeenCalledWith({ email: "p@example.test", phone: null }));
  });
});
