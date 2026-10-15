import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { queryKeys } from "@/lib/queryKeys";

export type WheelResponse = components["schemas"]["WheelResponse"];
export type WheelSegment = components["schemas"]["WheelSegmentResponse"];
export type WheelSpin = components["schemas"]["WheelSpinResponse"];
export type WheelState = components["schemas"]["WheelPlayerState"];
export type WheelPrizeType = components["schemas"]["WheelPrizeType"];

/** A fresh id for one tap of Spin (bonus answers the same spin for the same id, so a retried tap never spends twice). */
export function newSpinRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The wheel as the page uses it: bonus's answer with the slices in wheel order, plus how far the phone's clock is
 * from bonus's (`clockOffsetMs` = serverTime − the phone's now, when the answer arrived) so every countdown runs on
 * the server's clock, never on a phone set five minutes fast.
 */
export interface Wheel extends Omit<WheelResponse, "segments" | "pendingChoices"> {
  segments: WheelSegment[];
  /** Free-spins prizes (from any day) still waiting for the player to pick their game — never undefined. */
  pendingChoices: WheelSpin[];
  /** Extra spins an operator gave this player, usable after the day's free spin — never undefined. */
  extraSpins: number;
  clockOffsetMs: number;
}

/** An ISO instant as epoch ms; null when there is none (the schema types the date-times as unknown). */
export function instant(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

export function toWheel(data: WheelResponse, receivedAt: number): Wheel {
  const server = instant(data.serverTime);
  return {
    ...data,
    segments: [...(data.segments ?? [])].sort((a, z) => a.position - z.position),
    pendingChoices: data.pendingChoices ?? [],
    extraSpins: Math.max(0, data.extraSpins ?? 0),
    clockOffsetMs: server === null ? 0 : server - receivedAt,
  };
}

/** GET /api/bonus/wheel — a guest reads it too (state signInRequired); signing in or out refreshes it (session prefix). */
export const wheelQuery = () =>
  queryOptions({
    queryKey: queryKeys.session.wheel(),
    queryFn: async () => toWheel((await api.GET("/api/bonus/wheel")).data!, Date.now()),
    // read by the bottom nav on every page too (whether to show Lucky Wheel): one shared answer, a minute fresh
    staleTime: 60_000,
  });

export function useWheel() {
  return useQuery(wheelQuery());
}

/**
 * POST /api/bonus/wheel/spin — the day's free spin, or (once that is used) one of the player's extra spins. Every
 * call carries the tap's `requestId`: the same id answers the same spin (`replayed`), so retrying a tap whose answer
 * was lost never spends a second extra spin. The wheel itself is re-read by the page once the animation has landed,
 * not here: refreshing mid-spin would flip the page under the wheel.
 */
export function useSpinWheel() {
  const qc = useQueryClient();
  return useMutation<WheelSpin, ApiError, { requestId: string }>({
    mutationFn: async ({ requestId }) => (await api.POST("/api/bonus/wheel/spin", { body: { requestId } })).data!,
    // A prize is a bonus or free spins: everything bonus answers for this player may have changed.
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.session.bonusAll() }),
  });
}

/**
 * POST /api/bonus/wheel/spins/{spinId}/choose — the ONE game a multi-game free-spins prize ("awaitingGame") is
 * credited on. Idempotent for the same game (a retry gets the same answer); a different game after a choice is a 409.
 * Whatever the answer, the wheel is re-read (the prize leaves `pendingChoices`, or its window has closed); a credit
 * also refreshes everything bonus answers for the player, so My Account shows the new free spins.
 */
export function useChooseWheelGame() {
  const qc = useQueryClient();
  return useMutation<WheelSpin, ApiError, { spinId: string; gameId: string }>({
    mutationFn: async ({ spinId, gameId }) =>
      (await api.POST("/api/bonus/wheel/spins/{spinId}/choose", { params: { path: { spinId } }, body: { gameId } })).data!,
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.session.bonusAll() }),
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.session.wheel() }),
  });
}

/** The game a free-spins prize is (or will be) played on: the chosen one, else the only one it allows. */
export function spinGameId(spin: Pick<WheelSpin, "chosenGameId" | "freeSpinGameIds">): string | null {
  if (spin.chosenGameId) return spin.chosenGameId;
  const ids = spin.freeSpinGameIds ?? [];
  return ids.length === 1 ? ids[0]! : null;
}

/** Re-read the wheel (after a spin has landed, a refusal, or a countdown reaching zero). */
export function useRefreshWheel() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.session.wheel() });
}
