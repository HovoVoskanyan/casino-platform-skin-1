import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/features/auth/session";

/**
 * P3-27: the lobby's reads over P3-23's endpoints, through the gateway on the host's skin. Nothing here is per
 * player except the ♥; every read asks in the UI language (core resolves each text against the skin's languages
 * and falls back to the default copy, so a missing Filipino title shows the English one, never a blank).
 */
export type GameCard = components["schemas"]["LobbyGameResponse"];
export type GameDetail = components["schemas"]["LobbyGameDetailResponse"];
export type GamePage = components["schemas"]["LobbyGamePageResponse"];
export type Category = components["schemas"]["LobbyCategoryResponse"];
export type Provider = components["schemas"]["LobbyProviderResponse"];
export type Banner = components["schemas"]["LobbyBannerResponse"];
export type Promotion = components["schemas"]["LobbyPromotionResponse"];
export type PromotionDetail = components["schemas"]["LobbyPromotionDetailResponse"];

export const SORTS = ["popular", "newest", "name", "provider"] as const;
export type Sort = (typeof SORTS)[number];
export type Badge = "hot" | "new";

export interface GameFilters {
  q?: string;
  category?: string;
  provider?: string;
  badge?: Badge;
  sort?: Sort;
}

/** The design pages in twelves ("Load More"). */
export const PAGE_SIZE = 12;

/** Core answers in the language the request asks for; the header follows the UI, not the browser. */
const lang = (language: string) => ({ "Accept-Language": language });

/** Core's answers are cacheable for 30 s; matching that client-side keeps a tab from re-asking on every mount. */
const STALE = 30_000;

async function unwrap<T>(call: Promise<{ data?: T }>): Promise<T> {
  const { data } = await call;
  return data as T;
}

export const gamesQueryOptions = (language: string, filters: GameFilters, pageSize = PAGE_SIZE) =>
  infiniteQueryOptions({
    queryKey: queryKeys.lobby.games(language, { ...filters, pageSize }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      unwrap<GamePage>(api.GET("/api/v1/games", {
        params: { query: { ...filters, q: filters.q || undefined, page: pageParam, pageSize } },
        headers: lang(language),
      })),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    staleTime: STALE,
  });

export function useGames(filters: GameFilters, pageSize = PAGE_SIZE) {
  const { i18n } = useTranslation();
  return useInfiniteQuery(gamesQueryOptions(i18n.language, filters, pageSize));
}

export function useGame(id: string) {
  const { i18n } = useTranslation();
  return useQuery(queryOptions({
    queryKey: queryKeys.lobby.game(i18n.language, id),
    queryFn: () => unwrap<GameDetail>(api.GET("/api/v1/games/{id}", { params: { path: { id } }, headers: lang(i18n.language) })),
    staleTime: STALE,
  }));
}

export function useCategories() {
  const { i18n } = useTranslation();
  return useQuery(queryOptions({
    queryKey: queryKeys.lobby.categories(i18n.language),
    queryFn: () => unwrap<Category[]>(api.GET("/api/v1/categories", { headers: lang(i18n.language) })),
    staleTime: STALE,
  }));
}

export function useProviders() {
  return useQuery(queryOptions({
    queryKey: queryKeys.lobby.providers(),
    queryFn: () => unwrap<Provider[]>(api.GET("/api/v1/providers")),
    staleTime: STALE,
  }));
}

export function useBanners(placement: string) {
  const { i18n } = useTranslation();
  return useQuery(queryOptions({
    queryKey: queryKeys.lobby.banners(i18n.language, placement),
    queryFn: () => unwrap<Banner[]>(api.GET("/api/v1/banners", { params: { query: { placement } }, headers: lang(i18n.language) })),
    staleTime: STALE,
  }));
}

export function usePromotions() {
  const { i18n } = useTranslation();
  return useQuery(queryOptions({
    queryKey: queryKeys.lobby.promotions(i18n.language),
    queryFn: () => unwrap<Promotion[]>(api.GET("/api/v1/promotions", { headers: lang(i18n.language) })),
    staleTime: STALE,
  }));
}

export function usePromotion(id: string | null) {
  const { i18n } = useTranslation();
  return useQuery(queryOptions({
    queryKey: queryKeys.lobby.promotion(i18n.language, id ?? ""),
    queryFn: () => unwrap<PromotionDetail>(api.GET("/api/v1/promotions/{id}", { params: { path: { id: id! } }, headers: lang(i18n.language) })),
    enabled: id !== null,
    staleTime: STALE,
  }));
}

/** The player's ♥ list (game cards, newest first). A guest has none and never asks. */
export function useFavourites() {
  const { signedIn } = useSession();
  return useQuery(queryOptions({
    queryKey: queryKeys.session.favourites(),
    queryFn: () => unwrap<GameCard[]>(api.GET("/api/v1/me/favourites")),
    enabled: signedIn,
  }));
}

/** The ids behind every ♥ on screen, as a Set — one list read feeds every card on the page. */
export function useFavouriteIds(): ReadonlySet<string> {
  const { data } = useFavourites();
  return new Set((data ?? []).map((g) => g.id));
}

/**
 * ♥ / un-♥, optimistic: the heart flips at once and rolls back if core refuses. Both calls are idempotent on core's
 * side, so a double tap or a retry cannot leave a duplicate — the list is re-read after either answer.
 */
export function useToggleFavourite() {
  const qc = useQueryClient();
  const key = queryKeys.session.favourites();
  return useMutation({
    mutationFn: async ({ game, on }: { game: GameCard; on: boolean }) => {
      const path = { params: { path: { gameId: game.id } }, parseAs: "text" as const };
      if (on) await api.PUT("/api/v1/me/favourites/{gameId}", path);
      else await api.DELETE("/api/v1/me/favourites/{gameId}", path);
    },
    onMutate: async ({ game, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<GameCard[]>(key);
      qc.setQueryData<GameCard[]>(key, (list = []) => (on ? [game, ...list.filter((g) => g.id !== game.id)] : list.filter((g) => g.id !== game.id)));
      return { before };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
