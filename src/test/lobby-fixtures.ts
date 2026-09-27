import { http, HttpResponse } from "msw";
import type { Category, GameCard, Promotion, PromotionDetail, Provider } from "@/features/lobby/api";

export const game = (n: number, extra: Partial<GameCard> = {}): GameCard => ({
  id: `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`,
  name: `Game ${n}`,
  providerCode: "pragmatic",
  providerName: "Pragmatic Play",
  thumbnailUrl: null,
  hasDemo: true,
  badges: [],
  categories: ["slots"],
  ...extra,
});

export const CATEGORIES: Category[] = [
  { code: "slots", name: "Slots", thumbnailUrl: null, gameCount: 30 },
  { code: "live", name: "Live Casino", thumbnailUrl: null, gameCount: 4 },
];
export const PROVIDERS: Provider[] = [{ code: "pragmatic", name: "Pragmatic Play", thumbnailUrl: null, tag: "Hot", gameCount: 30 }];

export const PROMOTIONS: Promotion[] = [
  { id: "11111111-1111-7111-8111-111111111111", category: "welcome", title: "Welcome Bonus", value: "100% up to ₱5,000", body: "Make your first deposit and enjoy extra rewards.", imageUrl: null, endsAt: null },
  { id: "22222222-2222-7222-8222-222222222222", category: "reload", title: "Reload Bonus", value: "50% up to ₱3,000", body: "More value on your next deposit.", imageUrl: null, endsAt: null },
];

/**
 * A catalogue of `total` games served the way core pages it, recording every query it was asked so a test can pin
 * what the page sent (filters, page, language).
 */
export function catalogue(total: number, seen: URL[] = [], languages: (string | null)[] = []) {
  const all = Array.from({ length: total }, (_, i) => game(i + 1, i === 0 ? { badges: ["hot", "new"] } : {}));
  return [
    http.get("*/api/v1/games", ({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      languages.push(request.headers.get("accept-language"));
      const page = Number(url.searchParams.get("page") ?? 1);
      const size = Number(url.searchParams.get("pageSize") ?? 12);
      const items = all.slice((page - 1) * size, page * size);
      return HttpResponse.json({ items, total: all.length, page, pageSize: size });
    }),
    http.get("*/api/v1/categories", () => HttpResponse.json(CATEGORIES)),
    http.get("*/api/v1/providers", () => HttpResponse.json(PROVIDERS)),
    http.get("*/api/v1/banners", () => HttpResponse.json([])),
    http.get("*/api/v1/promotions", () => HttpResponse.json(PROMOTIONS)),
    http.get("*/api/v1/promotions/:id", ({ params }) => {
      const p = PROMOTIONS.find((x) => x.id === params.id);
      if (!p) return HttpResponse.json({ status: 404, errorCode: "NOT_FOUND" }, { status: 404 });
      const detail: PromotionDetail = { ...p, terms: `Terms for ${p.title}: wager 30x within 7 days.` };
      return HttpResponse.json(detail);
    }),
  ];
}
