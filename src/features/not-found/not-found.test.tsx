import { screen, waitFor, within } from "@testing-library/react";
import { renderRoute } from "@/test/route";
import { server } from "@/test/server";
import { catalogue } from "@/test/lobby-fixtures";
import { missingKind } from "./missing";

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute("content");
const canonical = () => document.head.querySelector('link[rel="canonical"]');

describe("the not-found page (owner 2026-11-25)", () => {
  it("reads a dead address as what it pointed at — this site's and the old site's", () => {
    expect(missingKind("/promotions/a399ce21-c434-48e2-8d51-3149516e268b")).toBe("promotion");
    expect(missingKind("/Bonuses")).toBe("promotion");
    expect(missingKind("/promo/summer")).toBe("promotion");
    expect(missingKind("/casino/game/sweet-bonanza")).toBe("game");
    expect(missingKind("/games/x/y/z")).toBe("game");
    expect(missingKind("/promotionsx")).toBe("page");
    expect(missingKind("/faq")).toBe("page");
  });

  it("an ended promotion says so, offers what is running now first, and is kept out of the index", async () => {
    server.use(...catalogue(2));
    renderRoute("/promotions/a399ce21-c434-48e2-8d51-3149516e268b");

    expect(await screen.findByRole("heading", { level: 1, name: "This promotion has ended" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all promotions" })).toHaveAttribute("href", "/promotions");
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
    const running = await screen.findByRole("region", { name: "Running now" });
    expect(within(running).getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Welcome Bonus", "Weekly Reload"]);
    const hot = await screen.findByRole("region", { name: "Hot Games" });
    expect(running.compareDocumentPosition(hot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await waitFor(() => expect(document.title).toBe("This promotion has ended | ChoCho"));
    expect(robots()).toBe("noindex, follow");
    expect(canonical()).toBeNull();
  });

  it("an old game address puts the hot games first; any other page links on to every section", async () => {
    server.use(...catalogue(2));
    const first = renderRoute("/casino/game/sweet-bonanza");
    expect(await screen.findByRole("heading", { level: 1, name: "This game isn’t here anymore" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all games" })).toHaveAttribute("href", "/games");
    const hot = await screen.findByRole("region", { name: "Hot Games" });
    const running = await screen.findByRole("region", { name: "Running now" });
    expect(hot.compareDocumentPosition(running) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    first.unmount();

    renderRoute("/no/such/page");
    expect(await screen.findByRole("heading", { level: 1, name: "We couldn’t find that page" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See all promotions" })).not.toBeInTheDocument();
    const explore = screen.getByRole("navigation", { name: "Explore ChoCho" });
    expect(within(explore).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/games", "/promotions", "/vip", "/"]);
    await waitFor(() => expect(document.title).toBe("We couldn’t find that page | ChoCho"));
  });
});
