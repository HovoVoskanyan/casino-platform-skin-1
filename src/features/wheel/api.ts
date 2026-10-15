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

/**
 * The wheel as the page uses it: bonus's answer with the slices in wheel order, plus how far the phone's clock is
 * from bonus's (`clockOffsetMs` = serverTime − the phone's now, when the answer arrived) so every countdown runs on
 * the server's clock, never on a phone set five minutes fast.
 */
export interface Wheel extends Omit<WheelResponse, "segments"> {
  segments: WheelSegment[];
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
 * POST /api/bonus/wheel/spin — today's spin. Idempotent per wheel day (a double tap or a retry after a lost answer
 * gets the same spin back, `replayed`), so the page may simply ask again. The wheel itself is re-read by the page
 * once the animation has landed, not here: refreshing mid-spin would flip the page to "spun today" under the wheel.
 */
export function useSpinWheel() {
  const qc = useQueryClient();
  return useMutation<WheelSpin, ApiError>({
    mutationFn: async () => (await api.POST("/api/bonus/wheel/spin")).data!,
    // A prize is a bonus or free spins: everything bonus answers for this player may have changed.
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.session.bonusAll() }),
  });
}

/** Re-read the wheel (after a spin has landed, a refusal, or a countdown reaching zero). */
export function useRefreshWheel() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.session.wheel() });
}
