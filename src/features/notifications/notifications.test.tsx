import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { server, signedIn } from "@/test/server";
import { fakeNotificationsHub } from "@/test/fake-hub";
import type { PlayerNotice } from "./api";

/** P3-30 — `notifications`' answers, shaped as `PlayerNoticeResponse`; the backend below keeps the player's state. */
let seq = 0;
const notice = (extra: Partial<PlayerNotice> = {}): PlayerNotice => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, kind: "staff", category: "service", title: "Hello", body: null, link: null,
  template: null, params: null, publishedAt: new Date(Date.now() - seq * 60_000).toISOString(), readAt: null, ...extra,
});

function backend(initial: PlayerNotice[], pageSize = 50) {
  const s = { items: [...initial], listed: 0, counted: 0, readAll: 0, dismissed: [] as string[] };
  const unread = () => s.items.filter((n) => !n.readAt).length;
  server.use(
    http.get("*/api/v1/notifications/unread-count", () => {
      s.counted++;
      return HttpResponse.json({ unreadCount: unread() });
    }),
    http.get("*/api/v1/notifications", ({ request }) => {
      s.listed++;
      const cursor = new URL(request.url).searchParams.get("cursor");
      const from = cursor ? Number(cursor) : 0;
      const page = s.items.slice(from, from + pageSize);
      return HttpResponse.json({ items: page, nextCursor: from + pageSize < s.items.length ? String(from + pageSize) : null, unreadCount: unread() });
    }),
    http.post("*/api/v1/notifications/read-all", () => {
      s.readAll++;
      s.items = s.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
      return HttpResponse.json({ unreadCount: 0 });
    }),
    http.post("*/api/v1/notifications/:id/dismiss", ({ params }) => {
      s.dismissed.push(String(params.id));
      s.items = s.items.filter((n) => n.id !== params.id);
      return HttpResponse.json({ unreadCount: unread() });
    }),
  );
  return s;
}

async function openDrawer() {
  const app = renderRoute("/vip");
  return { ...app, ...(await openDrawerFromHeader()) };
}

describe("in-site notifications (P3-30)", () => {
  it("the bell shows the unread count from the API (9+ above nine)", async () => {
    server.use(signedIn(), http.get("*/api/v1/notifications/unread-count", () => HttpResponse.json({ unreadCount: 3 })));
    renderRoute("/vip");
    const bell = await screen.findByRole("button", { name: "Notifications, 3 unread" });
    expect(within(bell).getByTestId("notifications-unread")).toHaveTextContent("3");
    act(() => fakeNotificationsHub.unread(12)); // another tab: the badge follows
    expect(await screen.findByTestId("notifications-unread")).toHaveTextContent("9+");
  });

  it("opening the drawer marks everything read: the badge drops to 0, the unread items stay highlighted until it closes", async () => {
    const s = backend([notice({ title: "First" }), notice({ title: "Second" }), notice({ title: "Old one", readAt: "2026-09-01T00:00:00Z" })]);
    server.use(signedIn());
    renderRoute("/vip");
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument();

    const { user, drawer, bell } = await openDrawerFromHeader();
    await within(drawer).findByText("First");
    await waitFor(() => expect(s.readAll).toBe(1));
    await waitFor(() => expect(screen.queryByTestId("notifications-unread")).toBeNull());
    const items = within(drawer).getAllByTestId("notice");
    expect(items.map((li) => li.textContent)).toEqual([expect.stringContaining("First"), expect.stringContaining("Second"), expect.stringContaining("Old one")]);
    expect(items.map((li) => li.hasAttribute("data-unread"))).toEqual([true, true, false]);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(bell).toHaveFocus();
    expect(bell).toHaveAccessibleName("Notifications");
    // Reopened: nothing is new any more, and nothing to mark.
    await user.click(bell);
    const again = await screen.findByRole("dialog", { name: "Notifications" });
    await within(again).findByText("First");
    expect(within(again).getAllByTestId("notice").some((li) => li.hasAttribute("data-unread"))).toBe(false);
    expect(s.readAll).toBe(1);
  });

  it("a system notice is written by the catalogue from its template, money formatted; an unknown template reads generically", async () => {
    backend([
      notice({ kind: "system", title: null, template: "deposit.completed", params: { amountCents: 50_000, currency: "PHP", count: null, expiresAt: null } }),
      notice({ kind: "system", title: null, template: "freespins.awarded", params: { amountCents: null, currency: null, count: 20, expiresAt: null } }),
      notice({ kind: "system", title: null, template: "something.new" }),
    ]);
    server.use(signedIn());
    const { drawer, user, router } = await openDrawer();
    expect(await within(drawer).findByText("Deposit received")).toBeInTheDocument();
    expect(within(drawer).getByText("₱500.00 has been added to your balance. Good luck!")).toBeInTheDocument();
    expect(within(drawer).getByText("You’ve got 20 free spins! Find them in My bonuses.")).toBeInTheDocument();
    expect(within(drawer).getByText("News from ChoCho")).toBeInTheDocument();

    // A deposit notice takes the player to the wallet.
    await user.click(within(drawer).getByRole("link", { name: /Deposit received/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/wallet"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull());
  });

  it("a staff notice is plain text; an https link opens in a new tab safely, a /path link navigates in the app", async () => {
    backend([
      notice({ title: "<b>Big weekend</b>", body: "Spin to win", category: "promo", link: "https://example.com/promo" }),
      notice({ title: "See the VIP club", link: "/promotions" }),
      notice({ title: "Sneaky", link: "javascript:alert(1)" }),
      // Review D1: a tab or newline inside the path would make the browser resolve it to //evil.example.
      notice({ title: "Tabbed", link: "/\t/evil.example/phish" }),
      notice({ title: "Newlined", link: "/\n/evil.example" }),
      notice({ title: "Backslashed", link: "/\\evil.example" }),
    ]);
    server.use(signedIn());
    const { drawer, user, router } = await openDrawer();
    const external = await within(drawer).findByRole("link", { name: /Big weekend/ });
    expect(external).toHaveAttribute("href", "https://example.com/promo");
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(drawer).getByText("<b>Big weekend</b>")).toBeInTheDocument();
    expect(drawer.querySelector("b")).toBeNull();
    expect(within(external).getByText("Promo")).toBeInTheDocument();
    for (const name of [/Sneaky/, /Tabbed/, /Newlined/, /Backslashed/]) expect(within(drawer).queryByRole("link", { name })).toBeNull();

    await user.click(within(drawer).getByRole("link", { name: /See the VIP club/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/promotions"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull());
  });

  it("✕ dismisses a notice: gone from the list, and from the server", async () => {
    const keep = notice({ title: "Keep me", readAt: "2026-09-01T00:00:00Z" });
    const drop = notice({ title: "Drop me", readAt: "2026-09-01T00:00:00Z" });
    const s = backend([keep, drop]);
    server.use(signedIn());
    const { drawer, user } = await openDrawer();
    await within(drawer).findByText("Drop me");
    await user.click(within(drawer).getByRole("button", { name: "Dismiss “Drop me”" }));
    await waitFor(() => expect(within(drawer).queryByText("Drop me")).toBeNull());
    expect(s.dismissed).toEqual([drop.id]);
    expect(within(drawer).getByText("Keep me")).toBeInTheDocument();
  });

  it("Load more follows nextCursor", async () => {
    backend(Array.from({ length: 3 }, (_, i) => notice({ title: `Notice ${i + 1}`, readAt: "2026-09-01T00:00:00Z" })), 2);
    server.use(signedIn());
    const { drawer, user } = await openDrawer();
    await within(drawer).findByText("Notice 2");
    expect(within(drawer).queryByText("Notice 3")).toBeNull();
    await user.click(within(drawer).getByRole("button", { name: "Load more" }));
    expect(await within(drawer).findByText("Notice 3")).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("an empty inbox and a failed load (with Retry)", async () => {
    let fail = true;
    server.use(signedIn(), http.get("*/api/v1/notifications", () =>
      fail ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ items: [], nextCursor: null, unreadCount: 0 })));
    const { drawer, user } = await openDrawer();
    const alert = await within(drawer).findByRole("alert");
    expect(alert).toHaveTextContent("We couldn’t load your notifications. Please try again.");
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await within(drawer).findByText("No notifications yet")).toBeInTheDocument();
  });

  it("a hub `notice` prepends it and bumps the badge; `withdrawn` takes it away", async () => {
    const old = notice({ title: "Older", readAt: "2026-09-01T00:00:00Z" });
    const s = backend([old]);
    server.use(signedIn());
    const user = userEvent.setup();
    renderRoute("/vip");
    await waitFor(() => expect(fakeNotificationsHub.started).toBe(1));
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();

    // Pushed with the drawer closed: the count is re-read.
    const fresh = notice({ title: "Just in", publishedAt: new Date().toISOString() });
    s.items = [fresh, ...s.items];
    act(() => fakeNotificationsHub.notice(fresh));
    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Notifications/ }));
    const drawer = await screen.findByRole("dialog", { name: "Notifications" });
    await within(drawer).findByText("Just in");
    await waitFor(() => expect(s.readAll).toBe(1));

    // Pushed with the drawer open: on top, highlighted, and read at once.
    const another = notice({ title: "Another one", publishedAt: new Date().toISOString() });
    s.items = [another, ...s.items];
    act(() => fakeNotificationsHub.notice(another));
    const first = (await within(drawer).findByText("Another one")).closest("li")!;
    expect(within(drawer).getAllByTestId("notice")[0]).toBe(first);
    expect(first).toHaveAttribute("data-unread");
    await waitFor(() => expect(s.readAll).toBe(2));

    // Staff withdrew it.
    s.items = s.items.filter((n) => n.id !== another.id);
    act(() => fakeNotificationsHub.withdrawn(another.id));
    await waitFor(() => expect(within(drawer).queryByText("Another one")).toBeNull());
    expect(within(drawer).getByText("Just in")).toBeInTheDocument();
  });

  it("a guest sees no bell and makes no notification calls", async () => {
    let asked = 0;
    server.use(
      http.get("*/api/v1/notifications/unread-count", () => { asked++; return HttpResponse.json({ unreadCount: 1 }); }),
      http.get("*/api/v1/notifications", () => { asked++; return HttpResponse.json({ items: [], nextCursor: null, unreadCount: 0 }); }),
    );
    renderRoute("/vip");
    await screen.findByRole("button", { name: "Sign in" });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /^Notifications/ })).toBeNull();
    expect(asked).toBe(0);
    expect(fakeNotificationsHub.started).toBe(0);
  });

  it("a refused negotiate (401) refreshes the session ONCE and connects again; so does the hub closing on an expired token", async () => {
    let refreshes = 0;
    server.use(signedIn(), http.post("*/api/id/auth/refresh", () => { refreshes++; return new HttpResponse(null, { status: 200 }); }));
    fakeNotificationsHub.failNextStarts = [new Error("Failed to complete negotiation with the server: Status code '401'")];
    renderRoute("/vip");
    await waitFor(() => expect(fakeNotificationsHub.started).toBe(2));
    expect(refreshes).toBe(1);

    act(() => fakeNotificationsHub.close(new Error("Server returned an error on close: Status code '401'")));
    await waitFor(() => expect(fakeNotificationsHub.started).toBe(3));
    expect(refreshes).toBe(2);
  });
});

async function openDrawerFromHeader() {
  const user = userEvent.setup();
  const bell = await screen.findByRole("button", { name: /^Notifications/ });
  await user.click(bell);
  const drawer = await screen.findByRole("dialog", { name: "Notifications" });
  return { user, drawer, bell };
}
