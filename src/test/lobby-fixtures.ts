import { http, HttpResponse } from "msw";
import type { Category, GameCard, Promotion, Provider } from "@/features/lobby/api";
import type { BonusDefinition, BonusSummary } from "@/features/bonus/api";

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

/** Bonus definitions switched on in the back office (bonus's catalog), as Home and Promotions list them. */
const definition = (id: string, name: string, type: BonusDefinition["type"], percent: number, capCents: number, currency = "PHP"): BonusDefinition => ({
  id, skinId: "chocho", name, code: null, type, status: "active", description: null, sticky: false, wageringMultiplier: 20,
  startAt: null, endAt: null, maxUsesPerPlayer: 1, totalSteps: 1,
  steps: [{ id: `${id}-s1`, stepNumber: 1, currency, maxBonusAmountCents: capCents, freeSpins: null, wageringMultiplier: null,
    intervals: [{ minDepositCents: 50_000, maxDepositCents: null, bonusPercent: percent, maxBonusCents: capCents }], freeSpinGameIds: [] }],
  allowedGameIds: [], gameContributions: [], minQualifyingStakeCents: null, maxQualifyingStakeCents: null,
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
} as BonusDefinition);
export const WELCOME = definition("0192b0a0-0000-7000-8000-0000000000a1", "Welcome Bonus", "welcome", 100, 500_000);
export const RELOAD = definition("0192b0a0-0000-7000-8000-0000000000a2", "Weekly Reload", "reload", 50, 200_000);
export const CASHBACK = definition("0192b0a0-0000-7000-8000-0000000000a4", "Weekly Cashback", "cashback", 10, 100_000);
export const EURO = definition("0192b0a0-0000-7000-8000-0000000000a3", "Euro Welcome", "welcome", 100, 500_000, "EUR");
export const summary = (bonus: BonusDefinition, claimable = true, hasPendingActivation = false): BonusSummary =>
  ({ bonus, hasPendingActivation, currentStepNumber: null, claimable }) as BonusSummary;

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
    // the guest's catalog read: two PHP bonuses and one in another currency (never shown on ChoCho)
    http.get("*/api/bonus", () => HttpResponse.json([summary(WELCOME, false), summary(RELOAD, false), summary(EURO, false)])),
  ];
}
