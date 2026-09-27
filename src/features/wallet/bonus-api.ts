import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/features/auth/session";

/**
 * P3-28 — the two counts the balance panel shows (design: "Available to claim" / "Active bonuses"). Bonus omits
 * nulls on the wire, so optional fields are read defensively.
 */
export function useBonusCounts() {
  const { signedIn } = useSession();
  const catalog = useQuery(queryOptions({
    queryKey: queryKeys.session.bonusCatalog(),
    queryFn: async () => (await api.GET("/api/bonus")).data ?? [],
    enabled: signedIn,
    staleTime: 60_000,
  }));
  const active = useQuery(queryOptions({
    queryKey: queryKeys.session.bonusActive(),
    queryFn: async () => (await api.GET("/api/bonus/active")).data ?? [],
    enabled: signedIn,
    staleTime: 30_000,
  }));
  return {
    isPending: catalog.isPending || active.isPending,
    isError: catalog.isError || active.isError,
    refetch: () => void Promise.all([catalog.refetch(), active.refetch()]),
    // Claimable = offered and not already waiting on an activation; active = running, or opted in and awaiting it.
    availableToClaim: (catalog.data ?? []).filter((b) => !b.hasPendingActivation).length,
    activeBonuses: (active.data ?? []).filter((b) => b.status === "active" || (b.hasPendingActivation && !b.status)).length,
  };
}
