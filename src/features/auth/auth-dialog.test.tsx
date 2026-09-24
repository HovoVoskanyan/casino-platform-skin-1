import { screen, waitFor } from "@testing-library/react";
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
    expect(await screen.findByText("Please accept the Terms & Conditions and Privacy Policy to continue.")).toBeInTheDocument();
    expect(seen).toBeNull();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(seen).not.toBeNull());
    expect(seen!.body).toMatchObject({ email: "new@example.test", username: null, verifyUrl: expect.stringMatching(/\/verify-email$/) });
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

    await user.click(screen.getByRole("tab", { name: "Email" }));
    await user.type(screen.getByLabelText("Email address"), "p@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));

    expect(await screen.findByText("Enter your reset code")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reset code"), "654321");
    await user.type(screen.getByLabelText("New password"), "Passw0rd!2345");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() => expect(reset).toHaveBeenCalledWith({ email: "p@example.test", otp: "654321", newPassword: "Passw0rd!2345" }));
    expect(await screen.findByText("Welcome back to ChoCho")).toBeInTheDocument();
  });

  it("the Phone tab is honest: registration by number waits on P3-24", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthDialog />);
    authDialog.open("register");
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("tab", { name: "Phone" }));
    expect(screen.getByText(/Registering with a mobile number is on its way/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
  });
});
