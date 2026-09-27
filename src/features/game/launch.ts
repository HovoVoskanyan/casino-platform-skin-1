import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import type { ApiError } from "@/api/problem";
import { queryKeys } from "@/lib/queryKeys";
import { SKIN_CURRENCY } from "@/lib/money";
import { useSession } from "@/features/auth/session";

/**
 * P3-28 — opening a game (P6-04): core answers the provider's HTML fragment, which the game container hosts. Demo and
 * real both need a signed-in player (core's launch is behind the player policy and the live-session check).
 */
export type Mode = "Demo" | "Real";
export type Launch = components["schemas"]["LaunchResponse"];

/** The design's only JS breakpoint: under 600px the provider serves its mobile client. */
export const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 600;

export function useLaunch(gameId: string) {
  const { i18n } = useTranslation();
  return useMutation<Launch, ApiError, { mode: Mode; withBonus: boolean }>({
    mutationFn: async ({ mode, withBonus }) =>
      (await api.POST("/api/v1/games/{id}/launch", {
        params: { path: { id: gameId } },
        body: {
          mode,
          // core takes a language tag; the provider wants the primary one (en, fil)
          language: i18n.language.split("-")[0] ?? null,
          isMobile: isMobileViewport(),
          // Real money is the skin's one currency (the wallet account it plays from); demo credits need none — core
          // takes the skin's default.
          currency: mode === "Real" ? SKIN_CURRENCY : null,
          withBonus,
        },
      })).data!,
  });
}

/**
 * Bonus's "play with your bonus balance?" read for this game (P6-04 launch-eligibility). Only asked for a signed-in
 * player; `isGameEligible` is what raises the prompt.
 */
export function useLaunchEligibility(gameId: string) {
  const { signedIn } = useSession();
  return useQuery(queryOptions({
    queryKey: queryKeys.session.launchEligibility(gameId),
    queryFn: async () => (await api.GET("/api/bonus/launch-eligibility", { params: { query: { gameId } } })).data!,
    enabled: signedIn,
    staleTime: 30_000,
  }));
}

/** Launch refusals → the notice copy (keys under `game.launchError.*`); anything unnamed is the generic line. */
export const LAUNCH_ERRORS = [
  "PLAYER_RESTRICTED", "CURRENCY_NOT_HELD", "BONUS_NOT_ELIGIBLE", "BONUS_UNAVAILABLE", "WALLET_UNAVAILABLE",
  "LAUNCH_PROVIDER_FAILED", "LAUNCH_NOT_CONFIGURED", "CONFLICT", "NOT_FOUND", "RATE_LIMITED", "SESSION_NOT_LIVE",
] as const;
