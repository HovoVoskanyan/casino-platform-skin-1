/**
 * The generated, typed API client — the ONLY way the skin talks to the platform (house rule: no hand-written
 * fetch). Types come from src/api/schema.d.ts, which `npm run api:sync` regenerates from the GATEWAY's aggregated
 * OpenAPI document (P3-26): identity under /api/id, core, payments and bonus as-is. The document's paths already
 * carry /api, so the base URL is the skin's own origin.
 *
 * Session transport is two httpOnly cookies the gateway sets and the browser attaches itself (P3-04 cookie mode);
 * the client never sees a token. On a 401 outside identity's auth routes it tries ONE refresh (`POST
 * /api/id/auth/refresh` with an EMPTY body — the gateway supplies the refresh cookie) and replays the request; a
 * failed refresh means the session is over: the cookies are already cleared, the app returns to guest.
 */
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { ApiError, toApiError, type ProblemDetails } from "./problem";

/** The skin's own origin, absolute so Node's fetch in tests resolves it too. */
export const API_ORIGIN = typeof window !== "undefined" ? window.location.origin : "http://localhost";

/** Called when the session is unrecoverable (refresh failed). Wired by the session provider. */
let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

let refreshInFlight: Promise<boolean> | null = null;

/** One refresh at a time: N parallel 401s collapse into a single refresh call. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_ORIGIN}/api/id/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

const isAuthRoute = (url: string) => url.includes("/api/id/auth/");

/** Marks a request that only ASKS whether a session exists: a 401 is the answer, not a reason to refresh or to declare the session lost. */
export const SESSION_PROBE_HEADER = "x-session-probe";

/** A pristine copy of each outgoing request, so a replay after refresh has an unread body. */
const replayable = new WeakMap<Request, Request>();

const authRetry: Middleware = {
  onRequest({ request }) {
    replayable.set(request, request.clone());
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || isAuthRoute(request.url) || request.headers.has(SESSION_PROBE_HEADER)) return response;
    const refreshed = await refreshSession();
    if (!refreshed) {
      onSessionLost?.();
      return response;
    }
    return globalThis.fetch(replayable.get(request) ?? request.clone());
  },
};

/** Turn every non-2xx into an ApiError so callers never inspect raw responses. */
const throwProblems: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return response;
    let problem: ProblemDetails = {};
    try {
      problem = (await response.clone().json()) as ProblemDetails;
    } catch {
      problem = { title: response.statusText };
    }
    throw new ApiError(response.status, problem);
  },
};

export const api = createClient<paths>({
  baseUrl: API_ORIGIN,
  credentials: "include",
  headers: { Accept: "application/json" },
  fetch: async (request) => {
    try {
      return await globalThis.fetch(request);
    } catch (e) {
      throw toApiError(e);
    }
  },
});
// onResponse middlewares run in REVERSE registration order: throwProblems first so authRetry sees the raw 401.
api.use(throwProblems);
api.use(authRetry);

export type { paths } from "./schema";
