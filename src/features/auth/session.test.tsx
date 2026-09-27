import { http, HttpResponse } from "msw";
import { QueryClient } from "@tanstack/react-query";
import { server, SESSIONS } from "@/test/server";
import { sessionQueryOptions } from "./session";

const fetchState = () => new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(sessionQueryOptions());

describe("the session probe", () => {
  it("a 401 is a guest, not an error", async () => {
    await expect(fetchState()).resolves.toEqual({ signedIn: false });
  });

  it("signed in only when the caller's OWN session is in the list", async () => {
    server.use(http.get("*/api/id/sessions", () => HttpResponse.json(SESSIONS)));
    await expect(fetchState()).resolves.toMatchObject({ signedIn: true });
  });

  it("a still-valid access token whose session was revoked (empty list, or no current) is a guest", async () => {
    // Sign-out-everywhere revokes the session rows; the access JWT is accepted for reads until it expires and the
    // list comes back without this device. Treating that as signed in would let old cookies revive the shell.
    server.use(http.get("*/api/id/sessions", () => HttpResponse.json(SESSIONS.map((s) => ({ ...s, current: false })))));
    await expect(fetchState()).resolves.toEqual({ signedIn: false });
    server.use(http.get("*/api/id/sessions", () => HttpResponse.json([])));
    await expect(fetchState()).resolves.toEqual({ signedIn: false });
  });

  it("no answer at all (identity down, an edge error) is a degraded guest, never a crash", async () => {
    // P3-27: the root loader awaited this probe and a thrown 502 rendered "Something went wrong" over the whole site —
    // including the anonymous lobby, which does not need identity at all.
    server.use(http.get("*/api/id/sessions", () => HttpResponse.json({ status: 502, errorCode: "UPSTREAM_UNAVAILABLE" }, { status: 502 })));
    await expect(fetchState()).resolves.toEqual({ signedIn: false, degraded: true });
    server.use(http.get("*/api/id/sessions", () => HttpResponse.json({ status: 404, errorCode: "UNKNOWN_HOST" }, { status: 404 })));
    await expect(fetchState()).resolves.toEqual({ signedIn: false, degraded: true });
  });
});
