import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, refreshSession, SESSION_PROBE_HEADER, setSessionLostHandler } from "@/api/client";
import { toApiError, type ApiError } from "@/api/problem";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/api/schema";

/**
 * Who is signed in, as far as the skin can know. Identity has no player "me" endpoint yet (recorded on P3-24), so
 * the session probe is the player's own sessions list: 200 = signed in, 401 = guest. The list also carries what
 * the account page shows. Cookie mode means the page never holds a token — the browser does.
 */
/**
 * `degraded` = the probe got no answer (identity down, an edge error): the site carries on as a guest — the lobby is
 * anonymous and must not go dark with identity — and asks again shortly (P3-27).
 */
export type SessionState = { signedIn: true; sessions: PlayerSession[] } | { signedIn: false; degraded?: true };

/** GET /api/id/sessions — identity answers `SessionResponse[]` but its document does not type it (no `.Produces<>`); mirrored here until it does. */
export interface PlayerSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

type CookieSession = components["schemas"]["CookieSessionResponse"];

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.session.state(),
    queryFn: async (): Promise<SessionState> => {
      try {
        const { data } = await api.GET("/api/id/sessions", { headers: { [SESSION_PROBE_HEADER]: "1" } });
        const sessions = (data as unknown as PlayerSession[]) ?? [];
        // A 200 alone is not "signed in": an access token outlives a revoked session until it expires (ADR-12's
        // denylist covers sensitive actions, not reads), and identity then answers a list WITHOUT the caller's own
        // session. The player is signed in only when their session is in it — the e2e's reuse-kill scenario.
        return sessions.some((s) => s.current) ? { signedIn: true, sessions } : { signedIn: false };
      } catch (e) {
        if (toApiError(e).status === 401) return { signedIn: false };
        // Not "no session" but "no answer": never take the whole site down for it (a thrown loader error did).
        return { signedIn: false, degraded: true };
      }
    },
    staleTime: 60_000,
    retry: false,
    refetchInterval: (query) => (query.state.data && !query.state.data.signedIn && query.state.data.degraded ? 15_000 : false),
  });

export function useSessionState() {
  return useQuery(sessionQueryOptions());
}

export interface SignUpInput {
  email: string;
  password: string;
  /** Affiliate attribution captured from the landing URL (P3-16): forwarded as identity's `externaldatakey` header. */
  affiliate?: string | null;
  source?: string | null;
}

/** Where identity's confirmation mail sends the player back: this skin's /verify-email, which reads ?email=&token=. */
export const verifyUrl = () => `${window.location.origin}/verify-email`;

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation<CookieSession, ApiError, SignUpInput>({
    mutationFn: async (input) => {
      const headers: Record<string, string> = {};
      if (input.affiliate) headers.externaldatakey = input.affiliate;
      if (input.source) headers["X-Source"] = input.source;
      const { data } = await api.POST("/api/id/auth/signup", {
        body: { email: input.email, password: input.password, username: null, verifyUrl: verifyUrl() },
        headers,
      });
      return data!;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.session.all }),
  });
}

export interface SignInInput {
  emailOrUsername: string;
  password: string;
  totpCode?: string | null;
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation<CookieSession, ApiError, SignInInput>({
    mutationFn: async (input) => {
      const { data } = await api.POST("/api/id/auth/signin", {
        body: { emailOrUsername: input.emailOrUsername, password: input.password, totpCode: input.totpCode ?? null },
      });
      return data!;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.session.all }),
  });
}

export function useForgotPassword() {
  return useMutation<void, ApiError, { email: string }>({
    mutationFn: async ({ email }) => {
      await api.POST("/api/id/auth/forgot-password", { body: { email }, parseAs: "text" });
    },
  });
}

export function useResetPassword() {
  return useMutation<void, ApiError, { email: string; otp: string; newPassword: string }>({
    mutationFn: async (body) => {
      await api.POST("/api/id/auth/reset-password", { body, parseAs: "text" });
    },
  });
}

export function useVerifyEmail() {
  return useMutation<void, ApiError, { email: string; token: string }>({
    mutationFn: async (body) => {
      await api.POST("/api/id/auth/verify-email", { body, parseAs: "text" });
    },
  });
}

export function useResendVerification() {
  return useMutation<void, ApiError, { email: string }>({
    mutationFn: async ({ email }) => {
      await api.POST("/api/id/auth/resend-verification", { body: { email, verifyUrl: verifyUrl() }, parseAs: "text" });
    },
  });
}

export function useChangePassword() {
  return useMutation<void, ApiError, { currentPassword: string; newPassword: string }>({
    mutationFn: async (body) => {
      await api.POST("/api/id/auth/change-password", { body, parseAs: "text" });
    },
  });
}

/** Identity's TOTP enrollment answer; its document does not type it either. */
export interface TotpEnrollment {
  secret: string;
  otpAuthUri: string;
}

export function useTotpEnroll() {
  return useMutation<TotpEnrollment, ApiError>({
    mutationFn: async () => (await api.POST("/api/id/totp/enroll")).data as unknown as TotpEnrollment,
  });
}

export function useTotpConfirm() {
  return useMutation<void, ApiError, { code: string }>({
    mutationFn: async (body) => {
      await api.POST("/api/id/totp/confirm", { body, parseAs: "text" });
    },
  });
}

export function useTotpDisable() {
  return useMutation<void, ApiError, { code: string }>({
    mutationFn: async (body) => {
      await api.POST("/api/id/totp/disable", { body, parseAs: "text" });
    },
  });
}

/**
 * Google, with the callback (owner decision 2026-09-24, P3-16): identity builds the authorize URL with a signed
 * state that carries where to land; Google returns to the gateway's callback on this domain; the gateway swaps the
 * token fragment for cookies and redirects to `{callbackUrl}#login=ok&expires_at=…&SessionId=…`. This is the
 * first leg only — the page then navigates to the URL identity answers.
 */
export function useGoogleSignIn() {
  return useMutation<string, ApiError, { returnTo?: string | null }>({
    mutationFn: async ({ returnTo }) => {
      const callbackUrl = `${window.location.origin}/auth/callback${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
      const { data } = await api.GET("/api/id/auth/google", { params: { query: { callbackUrl } } });
      const url = (data as unknown as { url?: string } | undefined)?.url;
      if (!url) throw toApiError(new Error("Google sign-in did not answer with a URL."));
      return url;
    },
  });
}

/** The Telegram login widget's payload, posted as identity's TelegramAuthRequest (snake_case on the wire). */
export type TelegramUser = components["schemas"]["TelegramAuthRequest"];

export function useTelegramSignIn() {
  const qc = useQueryClient();
  return useMutation<CookieSession, ApiError, TelegramUser>({
    mutationFn: async (user) => (await api.POST("/api/id/auth/telegram", { body: user })).data!,
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.session.all }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation<void, ApiError>({
    mutationFn: async () => {
      await api.POST("/api/id/sessions/logout", { parseAs: "text" });
    },
    onSettled: () => {
      qc.setQueryData(queryKeys.session.state(), { signedIn: false } satisfies SessionState);
      void qc.invalidateQueries({ queryKey: queryKeys.session.all });
    },
  });
}

export function useLogoutEverywhere() {
  const qc = useQueryClient();
  return useMutation<void, ApiError>({
    mutationFn: async () => {
      await api.POST("/api/id/sessions/logout-everywhere", { parseAs: "text" });
    },
    onSettled: () => {
      qc.setQueryData(queryKeys.session.state(), { signedIn: false } satisfies SessionState);
      void qc.invalidateQueries({ queryKey: queryKeys.session.all });
    },
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { sessionId: string }>({
    mutationFn: async ({ sessionId }) => {
      await api.POST("/api/id/sessions/{sessionId}/revoke", { params: { path: { sessionId } }, parseAs: "text" });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.session.all }),
  });
}

interface SessionCtx {
  state: SessionState;
  signedIn: boolean;
  /** Stop reacting to 401s — call before an intentional sign-out so its own 401s don't read as "session expired". */
  disarm: () => void;
}
const Ctx = createContext<SessionCtx | null>(null);

/**
 * Wraps the app: owns the "session lost" signal (reported ONCE) and the proactive refresh while a player is signed
 * in, so someone mid-form never hits a 401 round-trip. The player access token is short-lived; rotate well inside it.
 */
export function SessionProvider({ state, onLost, children }: { state: SessionState; onLost: () => void; children: ReactNode }) {
  const done = useRef(false);
  const lostOnce = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setSessionLostHandler(null);
    onLost();
  }, [onLost]);
  const disarm = useCallback(() => {
    done.current = true;
    setSessionLostHandler(null);
  }, []);

  useEffect(() => {
    if (!state.signedIn) return;
    done.current = false;
    setSessionLostHandler(lostOnce);
    return () => setSessionLostHandler(null);
  }, [lostOnce, state.signedIn]);

  useEffect(() => {
    if (!state.signedIn) return;
    const id = window.setInterval(() => {
      void refreshSession().then((ok) => {
        if (!ok) lostOnce();
      });
    }, 8 * 60_000);
    return () => window.clearInterval(id);
  }, [lostOnce, state.signedIn]);

  const value = useMemo(() => ({ state, signedIn: state.signedIn, disarm }), [state, disarm]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}
