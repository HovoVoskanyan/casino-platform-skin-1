import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import template from "./head.gotmpl?raw";
import { routeTree } from "@/routeTree.gen";
import { createTestQueryClient } from "@/test/render";

/**
 * The server answers 404 for every path its template does not route (owner 2026-11-25), so the template's `$routes`
 * must be the router's own table: a page added to the front but not there would reach people (the router still
 * shows it) as a 404 to every crawler. This holds the two to the same verdict, path by path.
 */
const line = template.match(/\$routes := list ((?:"[^"]+" ?)+)/);
const patterns = [...(line?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => new RegExp(m[1]!));

/** The template's verdict: either case, one trailing slash or none. */
function served(path: string) {
  let route = path.toLowerCase();
  if (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
  return patterns.some((p) => p.test(route));
}

const router = createRouter({ routeTree, history: createMemoryHistory(), context: { queryClient: createTestQueryClient() } });

/**
 * The router's verdict: whether its match for the path ends on the root's not-found (the page the user then sees is
 * the not-found page). `_notFound` is the router's own mark for that; were it ever renamed, every dead path below
 * would read as routed and this test would fail rather than pass quietly.
 */
function routed(path: string) {
  return !router.matchRoutes(path, {}).some((m) => (m as unknown as { _notFound?: boolean })._notFound);
}

/** Each route of the tree with its params filled in, optional ones both ways. */
function samples(): string[] {
  return Object.keys(router.routesByPath).flatMap((full) => {
    const filled = full.replace(/\$[A-Za-z]+/g, "x");
    return filled.includes("{-x}") ? [filled.replace("/{-x}", ""), filled.replace("{-x}", "slug")] : [filled];
  });
}

it("names the router's routes", () => {
  expect(patterns.length).toBeGreaterThan(5);
  const pages = samples();
  expect(pages).toEqual(expect.arrayContaining(["/", "/games", "/games/x", "/games/x/slug", "/promotions", "/info/x"]));
  for (const path of pages) expect([path, served(path)]).toEqual([path, true]);
});

it("gives every path the router's verdict — dead and old addresses included", () => {
  const paths = [
    ...samples(),
    "/promotions/a399ce21-c434-48e2-8d51-3149516e268b", "/promotions/", "/nope", "/Promotions", "/bonuses", "/casino/game/sweet-bonanza",
    "/casino", "/games/", "/games/x/slug/", "/games/x/slug/more", "/info", "/info/terms/", "/info/a/b", "/faq", "/auth/login",
    "/wallet/", "/account/x", "/vip/", "/lucky-wheel/x", "/favicon-old.png",
  ];
  for (const path of paths) expect([path, served(path)]).toEqual([path, routed(path)]);
});
