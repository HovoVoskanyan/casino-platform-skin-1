import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderRoute } from "@/test/route";

describe("Info pages (design copy, 24 Sep 2026 content pack)", () => {
  it("Responsible Gaming reads as a document with its index, PAGCOR's portal and Contact support", async () => {
    renderRoute("/info/responsible-gaming");
    expect(await screen.findByRole("heading", { level: 1, name: "Responsible Gaming" })).toBeInTheDocument();
    const index = screen.getByRole("navigation", { name: "On this page" });
    expect(within(index).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#responsible-play", "#account-controls", "#taking-a-break", "#getting-help"]);
    expect(screen.getByRole("link", { name: /PAGCOR self-exclusion application portal/ })).toHaveAttribute("href", "https://osea.pagcor.ph/");
    expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
    expect(screen.getByText("INTERNAL REVIEW · CONTENT DRAFT")).toBeInTheDocument(); // the copy is not approved yet
  });

  it("the FAQ opens an answer with its link into the site, and search narrows questions and topics", async () => {
    const user = userEvent.setup();
    renderRoute("/info/faq");
    expect(await screen.findByText("9 questions")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Where can I find my available and active bonuses?" }));
    expect(screen.getByRole("link", { name: /Open My Account → Bonuses/ })).toHaveAttribute("href", "/account?tab=bonuses");

    await user.type(screen.getByRole("searchbox", { name: "Search FAQs" }), "password");
    expect(screen.getByText("2 questions match.")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "FAQ topics" })).getAllByRole("link").map((a) => a.textContent)).toEqual(["Account", "Support"]);

    await user.clear(screen.getByRole("searchbox", { name: "Search FAQs" }));
    await user.type(screen.getByRole("searchbox", { name: "Search FAQs" }), "zebra");
    expect(screen.getByText("No matching questions")).toBeInTheDocument();
    // two ways out, as the design draws them: the ✕ in the field and the button in the no-results box
    await user.click(screen.getAllByRole("button", { name: "Clear search" }).at(-1)!);
    expect(screen.getByText("9 questions")).toBeInTheDocument();
  });
});
