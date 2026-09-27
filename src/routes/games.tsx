import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PageHero, Shell } from "@/components/layout/shell";
import { Rail } from "@/components/ui/rail";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { useSession } from "@/features/auth/session";
import { GameCardSkeleton, GameCardTile } from "@/features/lobby/game-card";
import { SORTS, useCategories, useFavourites, useGames, useProviders, type GameCard, type GameFilters, type Sort } from "@/features/lobby/api";

/**
 * Every filter lives in the URL (`?q=&category=&provider=&badge=&sort=&fav=1`): a filtered view survives a reload,
 * the back button and a shared link, and Home's tiles link straight into one. Unknown values are dropped, not
 * trusted — core would refuse them anyway.
 */
// The router JSON-parses each value, so a hand-typed `?q=777` arrives as the number 777 — read it back as text.
const text = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (typeof v === "number" ? String(v) : v), schema);
const code = text(z.string().regex(/^[a-z0-9][a-z0-9_-]*$/)).optional().catch(undefined);
const searchSchema = z.object({
  q: text(z.string().max(64)).optional().catch(undefined),
  category: code,
  provider: code,
  badge: z.enum(["hot", "new"]).optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  fav: z.coerce.boolean().optional().catch(undefined),
});
type GamesSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/games")({
  validateSearch: (search) => searchSchema.parse(search),
  component: GamesPage,
});

/**
 * Games (design: hero + search, category pills, Favourite Games, Popular, Providers, the grid with sort, the
 * favourites-only toggle and Load More). The catalogue is core's (P3-23) — only games this skin shows.
 */
function GamesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/games" });
  const set = (patch: Partial<GamesSearch>) => void navigate({ search: (prev) => clean({ ...prev, ...patch }), replace: true });
  const { signedIn } = useSession();
  const filtered = Boolean(search.q || search.category || search.provider || search.badge || (search.fav && signedIn));

  return (
    <Shell>
      <PageHero title={t("games.title")} subtitle={t("games.subtitle")}>
        <SearchBox value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} />
      </PageHero>
      <CategoryPills category={search.category} badge={search.badge} onPick={(category, badge) => set({ category, badge })} />
      {!filtered ? <FavouritesRail onViewAll={() => set({ fav: true })} /> : null}
      {!filtered ? <PopularRail onViewAll={() => set({ sort: "popular" })} /> : null}
      <ProvidersRail selected={search.provider} onPick={(provider) => set({ provider: provider === search.provider ? undefined : provider })} />
      <GameGrid search={search} set={set} />
    </Shell>
  );
}

const clean = (s: GamesSearch): GamesSearch => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== "" && v !== false)) as GamesSearch;

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  // The URL can change under the box (a pill, Back): adopt it during render, React's "adjust state on a prop change".
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  // Typing is debounced into the URL: one request per pause, not per keystroke.
  // Compared trimmed: "abc " is already "abc" in the URL — untrimmed, every later re-render re-sent the same search.
  useEffect(() => {
    if (text.trim() === value) return;
    const id = window.setTimeout(() => onChange(text.trim()), 300);
    return () => window.clearTimeout(id);
  }, [text, value, onChange]);
  return (
    <label className="relative block">
      <span className="sr-only">{t("games.search")}</span>
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cc-lavender)" strokeWidth="2" strokeLinecap="round" className="absolute top-1/2 left-[14px] -translate-y-1/2 md:left-4"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        type="search"
        value={text}
        maxLength={64}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("games.searchPlaceholder")}
        className="h-[52px] w-full rounded-cc-lg border border-cc-line-strong bg-[rgba(9,3,16,.45)] pr-3 pl-[42px] text-[16px] font-medium text-cc-ink placeholder:text-cc-muted focus:border-[rgba(255,201,60,.55)] focus:outline-none md:pl-[46px] md:text-[14.5px]"
      />
    </label>
  );
}

function CategoryPills({ category, badge, onPick }: { category?: string; badge?: "hot" | "new"; onPick: (category?: string, badge?: "hot" | "new") => void }) {
  const { t } = useTranslation();
  const { data: categories = [] } = useCategories();
  const pills: { key: string; label: string; on: boolean; pick: () => void }[] = [
    { key: "all", label: t("games.all"), on: !category && !badge, pick: () => onPick(undefined, undefined) },
    ...categories.map((c) => ({ key: c.code, label: c.name, on: category === c.code, pick: () => onPick(c.code, undefined) })),
    { key: "hot", label: t("games.hot"), on: badge === "hot" && !category, pick: () => onPick(undefined, "hot") },
    { key: "new", label: t("games.new"), on: badge === "new" && !category, pick: () => onPick(undefined, "new") },
  ];
  return (
    <nav aria-label={t("games.categories")} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
      {pills.map((p) => (
        <button key={p.key} type="button" aria-pressed={p.on} onClick={p.pick} className={cn("flex h-10 flex-none items-center rounded-full border px-4 text-[13.5px] font-bold whitespace-nowrap transition-colors", p.on ? "border-[rgba(255,201,60,.6)] bg-[image:var(--cc-gold-cta)] text-[#2c1400] shadow-[0_8px_22px_rgba(235,156,13,.32)]" : "border-cc-line bg-white/[.03] text-cc-text hover:border-cc-line-strong")}>
          {p.label}
        </button>
      ))}
    </nav>
  );
}

function FavouritesRail({ onViewAll }: { onViewAll: () => void }) {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const { data = [] } = useFavourites();
  if (!signedIn || data.length === 0) return null;
  return (
    <Rail title={t("games.favourites")} label={t("games.favourites")} action={<Button variant="ghost" size="sm" className="text-cc-gold" onClick={onViewAll}>{t("lobby.viewAll")}</Button>}>
      {data.map((g) => <GameCardTile key={g.id} game={g} variant="rail" />)}
    </Rail>
  );
}

function PopularRail({ onViewAll }: { onViewAll: () => void }) {
  const { t } = useTranslation();
  const popular = useGames({ sort: "popular" }, 10);
  const games = popular.data?.pages[0]?.items ?? [];
  if (!popular.isPending && games.length === 0) return null;
  return (
    <Rail title={t("games.popular")} label={t("games.popular")} action={<Button variant="ghost" size="sm" className="text-cc-gold" onClick={onViewAll}>{t("lobby.viewAll")}</Button>}>
      {popular.isPending ? Array.from({ length: 5 }, (_, i) => <GameCardSkeleton key={i} variant="rail" />) : games.map((g) => <GameCardTile key={g.id} game={g} variant="rail" />)}
    </Rail>
  );
}

function ProvidersRail({ selected, onPick }: { selected?: string; onPick: (code: string) => void }) {
  const { t } = useTranslation();
  const { data: providers = [] } = useProviders();
  if (providers.length === 0) return null;
  return (
    <Rail title={t("games.providers")} label={t("games.providers")}>
      {providers.map((p) => {
        const on = selected === p.code;
        const mark = p.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
        return (
          <button key={p.code} type="button" aria-pressed={on} onClick={() => onPick(p.code)} className={cn("flex h-[76px] w-[184px] flex-none snap-start items-center gap-3 rounded-cc-xl border px-4 text-left transition-colors", on ? "border-[rgba(255,201,60,.42)] bg-[linear-gradient(180deg,#2b1350_0%,#1c0b33_100%)]" : "border-cc-line bg-[linear-gradient(180deg,#23103f_0%,#180a2c_100%)] hover:border-cc-line-strong")}>
            {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="h-10 w-10 flex-none rounded-cc object-contain" /> : <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-cc bg-white/[.06] text-[13px] font-extrabold text-cc-control">{mark}</span>}
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className={cn("truncate text-[14px] font-extrabold", on ? "text-cc-gold-hover" : "text-cc-text")}>{p.name}</span>
              <span className={cn("text-[12px] font-semibold", on ? "text-[#d6bd8e]" : "text-cc-lavender")}>{t("lobby.gameCount", { count: p.gameCount })}</span>
            </span>
          </button>
        );
      })}
    </Rail>
  );
}

function GameGrid({ search, set }: { search: GamesSearch; set: (patch: Partial<GamesSearch>) => void }) {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const filters: GameFilters = { q: search.q, category: search.category, provider: search.provider, badge: search.badge, sort: search.sort };
  const games = useGames(filters);
  const favourites = useFavourites();
  const sort: Sort = search.sort ?? "popular";
  const nextSort = SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]!;
  const showFavourites = Boolean(search.fav && signedIn);

  // The favourites-only view is the player's ♥ list (≤ 200, newest first) narrowed by the same filters, client-side.
  const favouriteCards = useMemo(() => (showFavourites ? filterFavourites(favourites.data ?? [], search) : []), [showFavourites, favourites.data, search]);
  const items = showFavourites ? favouriteCards : (games.data?.pages.flatMap((p) => p.items) ?? []);
  const total = showFavourites ? favouriteCards.length : (games.data?.pages[0]?.total ?? 0);
  const pending = showFavourites ? favourites.isPending : games.isPending;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="all-games">
      <div className="flex flex-wrap items-center gap-3">
        <span id="all-games"><SectionTitle count={pending ? undefined : t("games.count", { count: total })}>{showFavourites ? t("games.favourites") : search.badge === "hot" ? t("games.hotGames") : search.badge === "new" ? t("games.newGames") : t("games.allGames")}</SectionTitle></span>
        <span className="min-w-2 flex-1" />
        <Button size="sm" aria-label={t("games.sortLabel", { sort: t(`games.sort.${sort}`) })} onClick={() => set({ sort: nextSort === "popular" ? undefined : nextSort })} disabled={showFavourites}>
          {t("games.sortBy")} <span className="text-cc-gold">{t(`games.sort.${sort}`)}</span>
        </Button>
        <Button
          size="sm"
          aria-pressed={showFavourites}
          className={cn(showFavourites && "border-[rgba(255,93,125,.5)] bg-[rgba(255,93,125,.16)] text-[#ff8da3]")}
          onClick={() => (signedIn ? set({ fav: !search.fav || undefined }) : authDialog.open("signin", window.location.pathname + window.location.search))}
        >
          ♥ {t("games.favouritesOnly")}
        </Button>
      </div>

      {games.isError && !showFavourites ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}
      {!pending && items.length === 0 && !(games.isError && !showFavourites) ? (
        <Notice tone="info">{showFavourites ? t("games.noFavourites") : search.q || search.category || search.provider || search.badge ? t("games.noMatch") : t("games.empty")}</Notice>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(142px,1fr))] md:gap-[14px]">
        {pending ? Array.from({ length: 12 }, (_, i) => <GameCardSkeleton key={i} />) : items.map((g) => <GameCardTile key={g.id} game={g} />)}
      </div>

      {!showFavourites && games.hasNextPage ? (
        <Button className="self-center" onClick={() => void games.fetchNextPage()} loading={games.isFetchingNextPage}>
          {t("games.loadMore", { shown: items.length, total })}
        </Button>
      ) : null}
    </section>
  );
}

function filterFavourites(list: GameCard[], s: GamesSearch): GameCard[] {
  const q = s.q?.toLowerCase();
  return list.filter((g) =>
    (!q || `${g.name} ${g.providerName}`.toLowerCase().includes(q))
    && (!s.provider || g.providerCode === s.provider)
    && (!s.category || g.categories.includes(s.category))
    && (!s.badge || g.badges.includes(s.badge)));
}
