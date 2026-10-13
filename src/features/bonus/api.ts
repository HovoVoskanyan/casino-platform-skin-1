import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { queryKeys } from "@/lib/queryKeys";
import { SKIN_CURRENCY } from "@/lib/money";
import { useSession } from "@/features/auth/session";

export type BonusSummary = components["schemas"]["BonusSummaryResponse"];
export type BonusDefinition = components["schemas"]["BonusDefinitionResponse"];
export type PlayerBonus = components["schemas"]["PlayerBonusResponse"];
export type PlayerFreeBet = components["schemas"]["PlayerFreeBetResponse"];
export type ClaimableFreeBet = components["schemas"]["ClaimableFreeBetResponse"];
export type Activation = components["schemas"]["ActivationResponse"];

/**
 * P3-29 — everything My bonuses reads, one query per bonus read (house rule: keys in queryKeys, under the session
 * prefix so signing out drops them). Bonus omits nulls on the wire, so optional fields are read defensively.
 */
export const bonusQueries = {
  catalog: () => queryOptions({
    queryKey: queryKeys.session.bonusCatalog(),
    queryFn: async () => (await api.GET("/api/bonus")).data ?? [],
    staleTime: 30_000,
  }),
  active: () => queryOptions({
    queryKey: queryKeys.session.bonusActive(),
    queryFn: async () => (await api.GET("/api/bonus/active")).data ?? [],
    staleTime: 30_000,
  }),
  freeBets: () => queryOptions({
    queryKey: queryKeys.session.bonusFreeBets(),
    queryFn: async () => (await api.GET("/api/bonus/freebets")).data ?? [],
    staleTime: 30_000,
  }),
  claimableSpins: () => queryOptions({
    queryKey: queryKeys.session.bonusClaimableSpins(),
    queryFn: async () => (await api.GET("/api/bonus/freebets/claimable")).data ?? [],
    staleTime: 30_000,
  }),
};

/**
 * Is this definition something a ChoCho player can be granted at all? The skin holds one currency, and a bonus whose
 * steps are all in another would opt in to nothing.
 */
export const offeredHere = (b: BonusDefinition) => (b.steps ?? []).some((s) => s.currency?.toUpperCase() === SKIN_CURRENCY);

/** A pending opt-in shows as a zero row with no status (bonus's "opted in, waiting for a deposit"). */
export const isAwaiting = (b: PlayerBonus) => !b.status && b.hasPendingActivation;
export const isRunning = (b: PlayerBonus) => b.status === "active";
export const spinsHeld = (f: PlayerFreeBet) => f.status === "active" && f.remainingCount > 0;

export interface BonusData {
  catalog: BonusSummary[];
  active: PlayerBonus[];
  freeBets: PlayerFreeBet[];
  claimableSpins: ClaimableFreeBet[];
}

/** The four reads as one state: the design has one loading, one error (with Retry) and one ready view. */
export function useBonusData() {
  const { signedIn } = useSession();
  const catalog = useQuery({ ...bonusQueries.catalog(), enabled: signedIn });
  const active = useQuery({ ...bonusQueries.active(), enabled: signedIn });
  const freeBets = useQuery({ ...bonusQueries.freeBets(), enabled: signedIn });
  const claimableSpins = useQuery({ ...bonusQueries.claimableSpins(), enabled: signedIn });
  const all = [catalog, active, freeBets, claimableSpins];
  const data: BonusData | undefined = all.every((q) => q.data)
    ? { catalog: catalog.data!, active: active.data!, freeBets: freeBets.data!, claimableSpins: claimableSpins.data! }
    : undefined;
  return {
    data,
    isPending: !data && all.some((q) => q.isPending),
    isError: !data && all.some((q) => q.isError),
    isFetching: all.some((q) => q.isFetching),
    refetch: () => Promise.all(all.map((q) => q.refetch())),
  };
}

/** What can be claimed now, and what the player holds — the two sections, and the balance panel's two counts. */
export function sections(data: BonusData) {
  const offers = data.catalog.filter((s) => s.claimable && offeredHere(s.bonus));
  const running = data.active.filter((b) => isRunning(b) || isAwaiting(b));
  const spins = data.freeBets.filter(spinsHeld);
  return { offers, claimableSpins: data.claimableSpins, running, spins };
}

/** P3-28's balance panel counts, now from the same reads and rules as the panel itself. */
export function useBonusCounts() {
  const bonus = useBonusData();
  const s = bonus.data ? sections(bonus.data) : null;
  return {
    isPending: bonus.isPending,
    isError: bonus.isError,
    refetch: bonus.refetch,
    availableToClaim: s ? s.offers.length + s.claimableSpins.length : 0,
    activeBonuses: s ? s.running.length + s.spins.length : 0,
  };
}

/**
 * Where a player stands with one open bonus — what its tile on Home / Promotions offers: a guest and a claimable
 * bonus offer Activate; an activated one waits for a deposit ("Deposit to claim"); a granted one is running; one whose
 * uses are spent is used.
 */
export type OfferState = "guest" | "claimable" | "awaiting" | "running" | "used";
export interface Offer { bonus: BonusDefinition; state: OfferState }

export function offerState(summary: BonusSummary, rows: PlayerBonus[]): OfferState {
  const mine = rows.filter((r) => r.bonusId === summary.bonus.id);
  if (mine.some(isRunning)) return "running";
  if (summary.hasPendingActivation || mine.some(isAwaiting)) return "awaiting";
  return summary.claimable ? "claimable" : "used";
}

/**
 * The bonuses an operator has switched on in the back office (Active, inside their dates) for this skin, in its
 * currency — what Home's Bonuses and the Promotions page list. A guest reads bonus's catalog anonymously (the
 * gateway opens that one read); a player reads it with their own standing, plus their bonuses, from the same
 * session reads My bonuses uses, so a claim anywhere updates every tile.
 */
export function useOffers() {
  const { signedIn } = useSession();
  const guest = useQuery({
    queryKey: queryKeys.lobby.bonuses(),
    queryFn: async () => (await api.GET("/api/bonus")).data ?? [],
    staleTime: 30_000,
    enabled: !signedIn,
  });
  const catalog = useQuery({ ...bonusQueries.catalog(), enabled: signedIn });
  const active = useQuery({ ...bonusQueries.active(), enabled: signedIn });

  let data: Offer[] | undefined;
  if (!signedIn && guest.data) data = guest.data.filter((s) => offeredHere(s.bonus)).map((s) => ({ bonus: s.bonus, state: "guest" }));
  if (signedIn && catalog.data && active.data) {
    const rows = active.data;
    data = catalog.data.filter((s) => offeredHere(s.bonus)).map((s) => ({ bonus: s.bonus, state: offerState(s, rows) }));
  }
  const reads = signedIn ? [catalog, active] : [guest];
  return { data, isPending: !data && reads.some((q) => q.isPending), isError: !data && reads.some((q) => q.isError) };
}

const useRefreshBonus = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.session.bonusAll() });
};

/** Opt in. Idempotent on bonus's side, so a retry after a lost answer cannot claim twice. */
export function useClaimBonus() {
  const refresh = useRefreshBonus();
  return useMutation<Activation, ApiError, { bonusId: string }>({
    mutationFn: async ({ bonusId }) => (await api.POST("/api/bonus/activate", { body: { bonusId, code: null } })).data!,
    // Success only: a refused claim keeps its card (and its message) until the list is next read.
    onSuccess: () => refresh(),
  });
}

/** Claim a free-rounds campaign; bonus assigns the rounds at the provider (through core) before answering. */
export function useClaimSpins() {
  const refresh = useRefreshBonus();
  return useMutation<PlayerFreeBet, ApiError, { freeBetId: string }>({
    mutationFn: async ({ freeBetId }) => (await api.POST("/api/bonus/freebets/claim", { body: { freeBetId, currency: SKIN_CURRENCY } })).data!,
    onSuccess: () => refresh(),
  });
}
