import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

export const SESSIONS = [
  { id: "01a07d30-b75c-76a4-8715-75a2ab47e4b9", ipAddress: "203.0.113.5", userAgent: "Mozilla/5.0 (iPhone)", createdAt: "2026-09-25T10:00:00Z", lastSeenAt: "2026-09-25T10:05:00Z", current: true },
  { id: "01a07d30-b75c-76a4-8715-75a2ab47e4ba", ipAddress: "203.0.113.9", userAgent: "Mozilla/5.0 (Macintosh)", createdAt: "2026-09-20T09:00:00Z", lastSeenAt: "2026-09-24T18:00:00Z", current: false },
];

export const cookieSession = () => HttpResponse.json({ expiresAt: new Date(Date.now() + 600_000).toISOString(), sessionId: SESSIONS[0]!.id });

/** P3-24: a signed-in player's account as identity answers it — email, verified, a password, consent on record. */
export const ACCOUNT = {
  playerId: "01a07d30-b75c-76a4-8715-75a2ab47e4c0", username: "juan", email: "juan@example.test", emailVerified: true, pendingEmail: null,
  phone: null, phoneVerified: false, pendingPhone: null, hasPassword: true, totpEnabled: false, linkedProviders: [] as string[],
  ageConfirmed: true, createdAt: "2026-09-20T09:00:00Z",
};

/** Default handlers describe a GUEST; tests that need a signed-in player override the sessions probe. */
export const handlers = [
  http.get("*/api/id/auth/account", () => HttpResponse.json(ACCOUNT)),
  http.get("*/api/v1/me/profile", () => HttpResponse.json({ displayName: null, city: null, playerNumber: 4820117 })),
  http.get("*/api/v1/me/favourites", () => HttpResponse.json([])),
  http.get("*/api/payments/history", () => HttpResponse.json([])),
  http.get("*/api/payments/methods/deposit", () => HttpResponse.json([])),
  http.get("*/api/payments/methods/withdraw", () => HttpResponse.json([])),
  http.get("*/api/bonus", () => HttpResponse.json([])),
  http.get("*/api/bonus/active", () => HttpResponse.json([])),
  http.get("*/api/id/sessions", () => problem(401, "UNAUTHORIZED")),
  http.post("*/api/id/auth/refresh", () => problem(401, "REFRESH_TOKEN_INVALID")),
  http.post("*/api/id/sessions/logout", () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlers);

export function problem(status: number, errorCode: string, detail = errorCode) {
  return HttpResponse.json({ status, detail, errorCode }, { status, headers: { "content-type": "application/problem+json" } });
}

export const signedIn = () => http.get("*/api/id/sessions", () => HttpResponse.json(SESSIONS));
