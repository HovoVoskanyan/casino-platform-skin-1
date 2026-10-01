import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/route";
import { problem, server, signedIn } from "@/test/server";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { fakeSupportHub } from "@/test/fake-hub";
import type { PlayerConversation, PlayerMessage } from "./support-store";

/** P3-31 — chat's answers, shaped as `Platform.Chat.Api` writes them. */
const CONVERSATION: PlayerConversation = { id: "c1", status: "open", unread: 0, lastMessageAt: "2026-09-30T10:05:00Z", createdAt: "2026-09-30T10:00:00Z" };
let seq = 0;
const line = (author: PlayerMessage["author"], body: string, extra: Partial<PlayerMessage> = {}): PlayerMessage => ({
  id: `m-${++seq}`, author, authorName: author === "agent" ? "Anna" : null, body, cannedAnswerId: null, clientMessageId: null,
  createdAt: new Date(Date.UTC(2026, 8, 30, 10, 0, seq)).toISOString(), ...extra,
});
const opened = (conversation: PlayerConversation | null, messages: PlayerMessage[], hasMore = false) =>
  http.get("*/api/v1/support/conversation", () => HttpResponse.json({ conversation, messages, hasMore }));

async function openPanel() {
  const user = userEvent.setup();
  renderRoute("/vip");
  const help = await screen.findByRole("button", { name: /^Help/ });
  await user.click(help);
  const panel = await screen.findByRole("dialog", { name: "Chat with ChoCho" });
  return { user, panel, help };
}

describe("the support panel (P3-31)", () => {
  afterEach(() => authDialog.close());

  it("Help opens the panel with the thread — agent, system and own lines as text, line breaks kept — and Escape returns focus", async () => {
    const older = line("player", "first ever line");
    const history = [line("player", "Hi, my deposit is late\nIt was ₱500"), line("agent", "Let me check that for you"), line("system", "Your withdrawal of ₱200 was received."), line("player", "<b>not html</b>")];
    let before: string | null = null;
    server.use(signedIn(), opened(CONVERSATION, history, true),
      http.get("*/api/v1/support/messages", ({ request }) => {
        before = new URL(request.url).searchParams.get("before");
        return HttpResponse.json({ items: [older], hasMore: false });
      }));
    const { user, panel, help } = await openPanel();
    expect(within(panel).getByText("Live support", { exact: false })).toBeInTheDocument();

    const log = within(panel).getByRole("log", { name: "Messages" });
    const deposit = await within(log).findByText(/Hi, my deposit is late/);
    expect(deposit.textContent).toBe("Hi, my deposit is late\nIt was ₱500");
    expect(within(log).getByText("Anna")).toBeInTheDocument(); // the agent's first name, never an email
    expect(within(log).getByText("Let me check that for you")).toBeInTheDocument();
    expect(within(log).getByText("ChoCho")).toBeInTheDocument(); // a system line speaks as ChoCho
    expect(within(log).getByText("<b>not html</b>")).toBeInTheDocument();
    expect(log.querySelector("b")).toBeNull();

    // Older history: the page before the first line loaded, shown above it.
    await user.click(within(log).getByRole("button", { name: "Earlier messages" }));
    expect(await within(log).findByText("first ever line")).toBeInTheDocument();
    expect(before).toBe(history[0]!.id);
    const texts = [...log.querySelectorAll("span.whitespace-pre-wrap")].map((n) => n.textContent);
    expect(texts[0]).toBe("first ever line");
    expect(within(log).queryByRole("button", { name: "Earlier messages" })).toBeNull();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Chat with ChoCho" })).toBeNull());
    expect(help).toHaveFocus();
  });

  it("sends at once (optimistic), and the hub's echo of the same line never doubles it", async () => {
    let sent: { clientMessageId: string; text: string | null; cannedAnswerId: string | null } | null = null;
    let answer!: () => void;
    server.use(signedIn(), opened(null, []),
      http.post("*/api/v1/support/messages", async ({ request }) => {
        sent = (await request.json()) as typeof sent;
        await new Promise<void>((r) => (answer = r));
        return HttpResponse.json({ conversation: CONVERSATION, messages: [echo()] });
      }));
    const echo = () => line("player", "Where is my withdrawal?", { id: "m-sent", clientMessageId: sent!.clientMessageId });
    const { user, panel } = await openPanel();
    const log = within(panel).getByRole("log");
    // Before the first line: the greeting.
    expect(await within(log).findByText(/how can I help you today/)).toBeInTheDocument();

    await user.type(within(panel).getByRole("textbox", { name: "Message" }), "Where is my withdrawal?{Enter}");
    expect(within(log).getByText("Where is my withdrawal?")).toBeInTheDocument();
    expect(within(log).getByText("Sending…")).toBeInTheDocument();
    expect(within(panel).getByRole("textbox", { name: "Message" })).toHaveValue("");
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent!.text).toBe("Where is my withdrawal?");
    expect(sent!.cannedAnswerId).toBeNull();
    expect(sent!.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);

    // The hub delivers the line before the POST answers …
    act(() => fakeSupportHub.message(echo()));
    expect(within(log).getAllByText("Where is my withdrawal?")).toHaveLength(1);
    expect(within(log).queryByText("Sending…")).toBeNull();
    // … and then the POST answers the same line.
    act(() => answer());
    await waitFor(() => expect(within(log).getAllByText("Where is my withdrawal?")).toHaveLength(1));
    act(() => fakeSupportHub.message(echo())); // and a duplicate push changes nothing
    expect(within(log).getAllByText("Where is my withdrawal?")).toHaveLength(1);

    // An agent's reply arrives live.
    act(() => fakeSupportHub.message(line("agent", "It's on its way!")));
    expect(within(log).getByText("It's on its way!")).toBeInTheDocument();
  });

  it("a canned question is tapped: sent by id, the answer comes back as a ChoCho line", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(signedIn(), opened(null, []),
      http.get("*/api/v1/support/canned", ({ request }) => {
        expect(new URL(request.url).searchParams.get("language")).toBe("en");
        return HttpResponse.json([{ id: "q-dep", question: "How do I deposit?" }, { id: "q-kyc", question: "How do I verify?" }]);
      }),
      http.post("*/api/v1/support/messages", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ conversation: CONVERSATION, messages: [
          line("player", "How do I deposit?", { cannedAnswerId: "q-dep", clientMessageId: sent.clientMessageId as string }),
          line("system", "Open Wallet → Deposit and pick GCash or Maya.", { cannedAnswerId: "q-dep" }),
        ] });
      }));
    const { user, panel } = await openPanel();
    const chips = await within(panel).findByRole("group", { name: "Quick questions" });
    await user.click(within(chips).getByRole("button", { name: "How do I deposit?" }));

    const log = within(panel).getByRole("log");
    expect(await within(log).findByText("Open Wallet → Deposit and pick GCash or Maya.")).toBeInTheDocument();
    expect(sent).toMatchObject({ cannedAnswerId: "q-dep", text: null });
    expect(within(log).getAllByText("How do I deposit?")).toHaveLength(1);
    expect(within(log).getByText("ChoCho")).toBeInTheDocument();
  });

  it("too fast (429) says so gently, and Retry resends the SAME line id", async () => {
    const ids: string[] = [];
    server.use(signedIn(), opened(CONVERSATION, [line("agent", "Hello!")]),
      http.post("*/api/v1/support/messages", async ({ request }) => {
        const body = (await request.json()) as { clientMessageId: string };
        ids.push(body.clientMessageId);
        if (ids.length === 1) return problem(429, "RATE_LIMITED");
        return HttpResponse.json({ conversation: CONVERSATION, messages: [line("player", "one more thing", { clientMessageId: body.clientMessageId })] });
      }));
    const { user, panel } = await openPanel();
    await within(panel).findByText("Hello!");
    await user.type(within(panel).getByRole("textbox", { name: "Message" }), "one more thing");
    await user.click(within(panel).getByRole("button", { name: "Send" }));

    const alert = await within(panel).findByRole("alert");
    expect(alert).toHaveTextContent("You’re sending messages a little fast. Wait a moment, then tap Retry.");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(within(panel).queryByRole("alert")).toBeNull());
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(within(panel).getAllByText("one more thing")).toHaveLength(1);
  });

  it("counts down near the 2000-character limit and never sends a blank line", async () => {
    server.use(signedIn(), opened(null, []));
    const { user, panel } = await openPanel();
    const box = within(panel).getByRole("textbox", { name: "Message" });
    const send = within(panel).getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    await user.type(box, "   ");
    expect(send).toBeDisabled();
    await user.clear(box);
    await user.click(box);
    await user.paste("x".repeat(1850));
    expect(within(panel).getByText("1850 / 2000")).toBeInTheDocument();
    expect(box).toHaveAttribute("maxLength", "2000");
  });

  it("a guest is asked to sign in (no chat, no calls), with the FAQ one tap away", async () => {
    const user = userEvent.setup();
    let asked = false;
    server.use(http.get("*/api/v1/support/conversation", () => {
      asked = true;
      return HttpResponse.json({ conversation: null, messages: [], hasMore: false });
    }));
    renderRoute("/vip");
    await user.click(await screen.findByRole("button", { name: "24/7 Support" })); // the footer entry
    const panel = await screen.findByRole("dialog", { name: "Chat with ChoCho" });
    expect(within(panel).getByText("Sign in to chat with us")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Read the FAQ" })).toHaveAttribute("href", "/info/faq");
    expect(within(panel).queryByRole("textbox")).toBeNull();

    await user.click(within(panel).getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("dialog", { name: "Welcome back to ChoCho" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Chat with ChoCho" })).toBeNull();
    expect(asked).toBe(false);
  });

  it("an unread reply badges Help while the panel is closed; opening it marks it read", async () => {
    let reads = 0;
    const reply = line("agent", "Any update on your side?");
    server.use(signedIn(),
      http.get("*/api/v1/support/conversation", () => HttpResponse.json({ conversation: { ...CONVERSATION, unread: reads ? 0 : 1 }, messages: [reply], hasMore: false })),
      http.post("*/api/v1/support/read", () => {
        reads++;
        return new HttpResponse(null, { status: 204 });
      }));
    const user = userEvent.setup();
    renderRoute("/vip");
    await waitFor(() => expect(fakeSupportHub.started).toBe(1));
    // The thread is read on connect: the dot shows without opening anything.
    const help = await screen.findByRole("button", { name: /^Help\s*1 unread reply from support$/ });
    expect(within(help).getByTestId("support-unread")).toHaveTextContent("1");

    // A new reply arrives on the hub with the panel closed.
    act(() => fakeSupportHub.conversation({ ...CONVERSATION, unread: 2 }));
    expect(screen.getByRole("button", { name: /^Help\s*2 unread replies from support$/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Help/ }));
    const panel = await screen.findByRole("dialog", { name: "Chat with ChoCho" });
    await waitFor(() => expect(reads).toBe(1));
    expect(within(panel).getByText("Any update on your side?")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
    expect(screen.queryByTestId("support-unread")).toBeNull();
  });

  it("one hub connection while signed in; a reconnect re-reads the thread (a push missed while down heals)", async () => {
    let back = false;
    const missed = line("agent", "Sent while you were offline");
    server.use(signedIn(), http.get("*/api/v1/support/conversation", () =>
      HttpResponse.json({ conversation: CONVERSATION, messages: back ? [missed] : [], hasMore: false })));
    const { panel } = await openPanel();
    expect(await within(panel).findByText(/how can I help you today/)).toBeInTheDocument();
    back = true;
    act(() => fakeSupportHub.reconnected?.());
    expect(await within(panel).findByText("Sent while you were offline")).toBeInTheDocument();
    expect(fakeSupportHub.started).toBe(1);
  });

  it("#support on any page opens the panel", async () => {
    server.use(signedIn(), opened(null, []));
    renderRoute("/vip");
    await screen.findByRole("button", { name: /^Help/ });
    act(() => {
      window.location.hash = "#support";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByRole("dialog", { name: "Chat with ChoCho" })).toBeInTheDocument();
  });
});
