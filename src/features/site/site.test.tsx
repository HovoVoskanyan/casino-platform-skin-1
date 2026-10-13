import { render, screen, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import i18n from "@/i18n";
import { renderRoute } from "@/test/route";
import { server } from "@/test/server";
import { catalogue } from "@/test/lobby-fixtures";
import { peso, pesoWhole, setSkinCurrency, toCents } from "@/lib/money";
import { RichText } from "@/components/ui/rich-text";

const site = (languages: string[], defaultLanguage: string, currency = "PHP") =>
  http.get("*/api/v1/site", () => HttpResponse.json({ defaultLanguage, languages, defaultCurrency: currency, currencies: [currency] }));

describe("the site's languages and currency come from the back office (owner 2026-10-13)", () => {
  it("opens in the site's default language and offers its languages in the footer; a choice sticks", async () => {
    const user = userEvent.setup();
    server.use(site(["en-ph", "fil"], "fil"), ...catalogue(1));
    renderRoute("/");
    const primary = await screen.findByRole("banner"); // the header
    expect(within(primary).getByRole("link", { name: "Mga Laro" })).toBeInTheDocument(); // Filipino: the site's default
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("img", { name: "Para lamang sa 21 taong gulang pataas" })).toHaveTextContent("21+"); // PAGCOR: 21, not 18
    const select = within(footer).getByRole("combobox", { name: "Wika" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["English", "Filipino"]);

    await user.selectOptions(select, "en-PH");
    expect(await within(primary).findByRole("link", { name: "Games" })).toBeInTheDocument();
    expect(localStorage.getItem("chocho.lang")).toBe("en-PH"); // the player's own pick, kept for the next visit
  });

  it("a site with one language shows no switcher, and a stored pick it no longer offers gives way to its default", async () => {
    localStorage.setItem("chocho.lang", "fil");
    server.use(site(["en-ph"], "en-ph"), ...catalogue(1));
    renderRoute("/");
    expect(await within(await screen.findByRole("banner")).findByRole("link", { name: "Games" })).toBeInTheDocument();
    expect(within(screen.getByRole("contentinfo")).queryByRole("combobox")).toBeNull();
  });

  it("money shows in the site's currency", () => {
    setSkinCurrency("USD");
    expect(peso(123456)).toBe("$1,234.56");
    expect(pesoWhole(50000)).toBe("$500");
    expect(toCents("$1,250.50")).toBe(125050);
    setSkinCurrency("PHP");
    expect(peso(123456)).toBe("₱1,234.56");
    expect(toCents("-5")).toBeNull(); // only a sign, commas and spaces are cleaned — never a minus
  });

  it("Filipino plurals and numbers: the noun doesn't inflect, and Filipino's \"one\" form covers 1250 too", async () => {
    await i18n.changeLanguage("fil");
    const fil = i18n.getFixedT("fil");
    expect(fil("games.count", { count: 1 })).toBe("1 na laro");
    expect(fil("games.count", { count: 1250 })).toBe("1,250 na laro"); // Intl.PluralRules("fil") calls 1250 "one"
    expect(fil("games.count", { count: 4 })).toBe("4 na laro");
  });
});

describe("rich copy", () => {
  it("formats bold, links and lists from a translation — as React, never as HTML", async () => {
    const text = "Read **the terms** first.\n\n- one\n- two\n\nSee [Privacy](/info/privacy) or [NPC](https://privacy.gov.ph/). <img src=x onerror=alert(1)>";
    const rootRoute = createRootRoute({ component: () => <RichText text={text} /> });
    render(<RouterProvider router={createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) })} />);
    expect((await screen.findByText("the terms")).tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem").map((l) => l.textContent)).toEqual(["one", "two"]);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/info/privacy");
    expect(screen.getByRole("link", { name: "NPC" })).toHaveAttribute("target", "_blank");
    expect(document.querySelector("img")).toBeNull(); // markup in a translation stays text
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
});

