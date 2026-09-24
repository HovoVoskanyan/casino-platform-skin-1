import { http, HttpResponse } from "msw";
import { api, setSessionLostHandler } from "./client";
import { server, problem, SESSIONS } from "@/test/server";
import { isApiError } from "./problem";

describe("api client (cookie mode over the gateway)", () => {
  afterEach(() => setSessionLostHandler(null));

  it("turns a ProblemDetails answer into an ApiError with the edge's errorCode", async () => {
    server.use(http.post("*/api/id/auth/signin", () => problem(401, "INVALID_CREDENTIALS", "nope")));
    await expect(api.POST("/api/id/auth/signin", { body: { emailOrUsername: "a@b.c", password: "x", totpCode: null } })).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.status === 401 && e.errorCode === "INVALID_CREDENTIALS",
    );
  });

  it("on a 401 outside /auth it refreshes ONCE with an empty body and replays", async () => {
    let calls = 0;
    const refreshBodies: string[] = [];
    server.use(
      http.get("*/api/id/sessions", () => (++calls === 1 ? problem(401, "UNAUTHORIZED") : HttpResponse.json(SESSIONS))),
      http.post("*/api/id/auth/refresh", async ({ request }) => {
        refreshBodies.push(await request.text());
        return HttpResponse.json({ expiresAt: new Date().toISOString(), sessionId: "s" });
      }),
    );
    const { data } = await api.GET("/api/id/sessions");
    expect(calls).toBe(2);
    expect(refreshBodies).toEqual([""]);
    expect(data).toHaveLength(2);
  });

  it("a failed refresh reports the session lost exactly once and surfaces the 401", async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    server.use(http.get("*/api/id/sessions", () => problem(401, "UNAUTHORIZED")));
    await expect(api.GET("/api/id/sessions")).rejects.toSatisfy((e: unknown) => isApiError(e) && e.status === 401);
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it("never refreshes on an auth route's own 401 (a wrong password is an answer)", async () => {
    const refresh = vi.fn(() => problem(401, "REFRESH_TOKEN_INVALID"));
    server.use(http.post("*/api/id/auth/signin", () => problem(401, "INVALID_CREDENTIALS")), http.post("*/api/id/auth/refresh", refresh));
    await expect(api.POST("/api/id/auth/signin", { body: { emailOrUsername: "a@b.c", password: "x", totpCode: null } })).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
