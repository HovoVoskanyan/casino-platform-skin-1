import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/render";
import { server, signedIn, SESSIONS } from "@/test/server";
import { SessionsTab } from "./sessions-tab";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

describe("own sessions", () => {
  it("lists every device, marks this one, and revokes another by id", async () => {
    const user = userEvent.setup();
    const revoked: string[] = [];
    server.use(signedIn(), http.post("*/api/id/sessions/:id/revoke", ({ params }) => { revoked.push(String(params.id)); return new HttpResponse(null, { status: 204 }); }));
    renderWithProviders(<SessionsTab />, { session: { signedIn: true, sessions: SESSIONS } });

    expect(await screen.findByText("This device")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const other = screen.getAllByRole("listitem")[1]!;
    await user.click(within(other).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(revoked).toEqual([SESSIONS[1]!.id]));
  });

  it("sign out everywhere ends the session and returns home", async () => {
    const user = userEvent.setup();
    const everywhere = vi.fn();
    server.use(signedIn(), http.post("*/api/id/sessions/logout-everywhere", () => { everywhere(); return new HttpResponse(null, { status: 204 }); }));
    renderWithProviders(<SessionsTab />, { session: { signedIn: true, sessions: SESSIONS } });
    await screen.findByText("This device");

    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));

    await waitFor(() => expect(everywhere).toHaveBeenCalled());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });
});
