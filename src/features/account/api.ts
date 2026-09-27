import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import type { ApiError } from "@/api/problem";
import { queryKeys } from "@/lib/queryKeys";
import type { TFunction } from "i18next";
import { useSession, verifyUrl, useResendPhoneVerification, useResendVerification, useVerifyPhone } from "@/features/auth/session";

/**
 * P3-24 — My Account over identity (the account: contacts, pending changes, sign-in methods, the age consent) and core
 * (the profile). Every change re-reads the account, so the screen always shows what identity holds.
 */
export type Account = components["schemas"]["AccountResponse"];
export type Profile = components["schemas"]["PlayerProfileResponse"];
export type Contact = "email" | "phone";

/** The skin's brand prefix for the player number (fork per skin, ADR-16): CHO-4 820 117. */
export const PLAYER_NUMBER_PREFIX = "CHO";
export const formatPlayerNumber = (n: number) => {
  const digits = String(n);
  return `${PLAYER_NUMBER_PREFIX}-${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4)}`;
};

/**
 * My Account's error copy: its own wording first (a signed-in player changing a detail is not a visitor signing up, so
 * "Sign in instead" is wrong here), then the auth wording, then the generic line.
 */
export const accountErrorText = (t: TFunction, code: string | undefined) =>
  t(`account.error.${code ?? "UNKNOWN"}`, { defaultValue: t(`auth.error.${code ?? "UNKNOWN"}`, { defaultValue: t("auth.error.UNKNOWN") }) });

export const accountOptions = () =>
  queryOptions({
    queryKey: queryKeys.session.account(),
    queryFn: async () => (await api.GET("/api/id/auth/account")).data!,
    staleTime: 30_000,
  });

export function useAccount() {
  const { signedIn } = useSession();
  return useQuery({ ...accountOptions(), enabled: signedIn });
}

export function useProfile() {
  const { signedIn } = useSession();
  return useQuery(queryOptions({
    queryKey: queryKeys.session.profile(),
    queryFn: async () => (await api.GET("/api/v1/me/profile")).data!,
    enabled: signedIn,
  }));
}

function useAccountMutation<TVars>(run: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, TVars>({
    mutationFn: async (vars) => {
      await run(vars);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.session.account() }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation<Profile, ApiError, { displayName: string | null; city: string | null }>({
    mutationFn: async (body) => (await api.PUT("/api/v1/me/profile", { body })).data!,
    onSuccess: (profile) => qc.setQueryData(queryKeys.session.profile(), profile),
  });
}

/** Add or change a contact: a link to the new email, a code to the new number. The password is asked when the account has one. */
export function useStartContactChange() {
  return useAccountMutation<{ contact: Contact; value: string; password: string | null }>(({ contact, value, password }) =>
    contact === "email"
      ? api.POST("/api/id/auth/account/email", { body: { email: value, password, verifyUrl: verifyUrl() }, parseAs: "text" })
      : api.POST("/api/id/auth/account/phone", { body: { phone: value, password }, parseAs: "text" }));
}

export function useConfirmPhoneChange() {
  return useAccountMutation<{ code: string }>((body) => api.POST("/api/id/auth/account/phone/confirm", { body, parseAs: "text" }));
}

export function useResendContactChange() {
  return useAccountMutation<Contact>((contact) =>
    api.POST("/api/id/auth/account/{contact}/resend", { params: { path: { contact } }, body: { verifyUrl: contact === "email" ? verifyUrl() : null }, parseAs: "text" }));
}

export function useCancelContactChange() {
  return useAccountMutation<Contact>((contact) => api.DELETE("/api/id/auth/account/{contact}/pending", { params: { path: { contact } }, parseAs: "text" }));
}

export function useSetPassword() {
  return useAccountMutation<{ newPassword: string }>((body) => api.POST("/api/id/auth/account/password", { body, parseAs: "text" }));
}

export function useUnlinkTelegram() {
  return useAccountMutation<void>(() => api.POST("/api/id/auth/telegram/unlink", { parseAs: "text" }));
}

export function useConfirmAge() {
  return useAccountMutation<void>(() => api.POST("/api/id/auth/account/confirm-age", { parseAs: "text" }));
}

/**
 * P3-24 review S1: confirming the CURRENT contact later — a sign-up whose code step was skipped ("Later"), or an email
 * never confirmed. The sign-up endpoints, then the account re-read.
 */
export function useVerifyCurrentContact() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: queryKeys.session.account() });
  return {
    resendEmail: useResendVerification(),
    resendPhone: useResendPhoneVerification(),
    verifyPhone: useVerifyPhone(),
    refresh,
  };
}

/** Two-factor changed on this tab: the account view (which shows it) is re-read. */
export function useRefreshAccount() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.session.account() });
}

/** The link's landing (/verify-email?change=1): anonymous, like verify-email. */
export function useConfirmEmailChange() {
  return useMutation<void, ApiError, { email: string; token: string }>({
    mutationFn: async (body) => {
      await api.POST("/api/id/auth/confirm-email-change", { body, parseAs: "text" });
    },
  });
}
