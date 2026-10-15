import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Shell } from "@/components/layout/shell";
import { Rail, RailViewAll } from "@/components/ui/rail";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import { useSeo, type Seo } from "@/lib/seo";
import { gamesSeo } from "@/features/lobby/page-seo";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { useSession } from "@/features/auth/session";
import { GameCardSkeleton, GameCardTile } from "@/features/lobby/game-card";
import { GamesBanner } from "@/features/lobby/games-banner";
import { TrustStrip } from "@/features/lobby/home-panels";
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
 * Games (design: the illustrated banner, search under it, category pills, the filter row, Favourite Games, Popular, Game Providers, the grid
 * with sort and Load More, the trust strip). The catalogue is core's (P3-23) — only games this skin shows.
 */
function GamesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/games" });
  const set = (patch: Partial<GamesSearch>) => void navigate({ search: (prev) => clean({ ...prev, ...patch }), replace: true });
  const { signedIn } = useSession();
  const filtered = Boolean(search.q || search.category || search.provider || search.badge || (search.fav && signedIn));
  const toGrid = () => scrollToSection("all-games");
  useSeo(useGamesSeo(search));

  return (
    <Shell>
      <div className="flex flex-col gap-3 min-[600px]:gap-4">
        {/* Explore only moves the page: the search and filters in the URL stay as they are. */}
        <GamesBanner onExplore={() => { document.getElementById("all-games")?.focus({ preventScroll: true }); scrollToSection("all-games"); }} />
        <SearchBox value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} />
      </div>
      <section aria-label={t("games.filters")} className="-mb-[6px] flex flex-col gap-[14px] min-[600px]:gap-[18px]">
        <CategoryPills category={search.category} badge={search.badge} onPick={(category, badge) => set({ category, badge })} />
        <FilterRow
          favourites={Boolean(search.fav && signedIn)}
          onProviders={() => scrollToSection("game-providers")}
          onSort={(sort) => { set({ sort: sort === "popular" ? undefined : sort }); toGrid(); }}
          onFavourites={() => (signedIn ? set({ fav: !search.fav || undefined }) : authDialog.open("signin", window.location.pathname + window.location.search))}
        />
      </section>
      {!filtered ? <FavouritesRail onViewAll={() => { set({ fav: true }); toGrid(); }} /> : null}
      {!filtered ? <PopularRail onViewAll={() => { set({ sort: undefined, fav: undefined }); toGrid(); }} /> : null}
      <ProvidersRail selected={search.provider} onPick={(provider) => set({ provider: provider === search.provider ? undefined : provider })} />
      <GameGrid search={search} set={set} />
      <TrustStrip variant="games" className="-mt-4 min-[600px]:mt-0" />
    </Shell>
  );
}

/** Jumps to a section under the sticky header (its `scroll-mt`), gliding only when the player has not asked for reduced motion. */
function scrollToSection(id: string) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

function useGamesSeo(search: GamesSearch): Seo {
  const { t } = useTranslation();
  const { data: categories = [] } = useCategories();
  const { data: providers = [] } = useProviders();
  return gamesSeo(t, search, categories, providers);
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
      <svg aria-hidden width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cc-lavender)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 min-[600px]:left-5"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      <input
        type="search"
        value={text}
        maxLength={64}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("games.searchPlaceholder")}
        // 16px on phones: anything smaller and iOS zooms the page on focus
        className="h-[52px] w-full rounded-cc-xl border border-[rgba(167,139,250,.32)] bg-[linear-gradient(180deg,rgba(28,10,52,.92)_0%,rgba(18,6,34,.92)_100%)] pr-3 pl-[46px] text-[16px] font-medium text-cc-ink shadow-[inset_0_1px_0_rgba(255,255,255,.03)] transition-[border-color,box-shadow] placeholder:text-[#9c88bb] hover:border-[rgba(167,139,250,.48)] focus:border-[rgba(255,201,60,.7)] focus:shadow-[0_0_0_3px_rgba(255,201,60,.18)] focus:outline-none min-[600px]:h-14 min-[600px]:pr-5 min-[600px]:pl-[54px] min-[600px]:text-[16px]"
      />
    </label>
  );
}

/** The design's pill marks, by category code; a code it did not draw gets the star. */
const PILL_MARKS: Record<string, string> = {
  all: "M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z",
  slots: "M5 4h14v16H5zM9 8v8M15 8v8",
  live: "M4 6h12v9H4zM20 8v9M8 19h8",
  blackjack: "M7 5h7l4 5-7 9-4-5z",
  roulette: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 6a3 3 0 100 6 3 3 0 000-6z",
  crash: "M4 19l6-6 3 3 7-9",
  table: "M4 8h16l-2 9H6zM9 8V5h6v3",
  hot: "M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.2 1.2-3.6 2.4-4.6.3 1.6 1.1 2.6 2.1 2.6 0-2.8-.6-5.3.5-8z",
};
const STAR = "M12 4l2.2 4.6 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5L4.8 9.3l5-.7z";

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
    <nav aria-label={t("games.categories")} className="-mx-4 -my-1 flex gap-[10px] overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] min-[600px]:mx-[-2px] min-[600px]:px-[2px]">
      {pills.map((p) => (
        <button key={p.key} type="button" aria-pressed={p.on} onClick={p.pick} className={cn("flex h-[42px] flex-none items-center gap-2 rounded-cc-md border px-4 text-[13.5px] font-bold whitespace-nowrap transition-[border-color,background-color]", p.on ? "border-[rgba(255,201,60,.6)] bg-[image:var(--cc-gold-cta)] text-[#2c1400] shadow-[0_8px_22px_rgba(235,156,13,.32)]" : "border-cc-line bg-white/[.03] text-cc-text hover:border-cc-line-strong")}>
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={p.on ? "#2c1400" : "#c4b5fd"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={PILL_MARKS[p.key] ?? STAR} /></svg>
          {p.label}
        </button>
      ))}
    </nav>
  );
}

/** Design: Providers (jumps to the rail) / Popularity / Newest (sort the grid and jump to it) and the ♥ Favourites toggle — one scrolling row on phones. */
function FilterRow({ favourites, onProviders, onSort, onFavourites }: { favourites: boolean; onProviders: () => void; onSort: (sort: Sort) => void; onFavourites: () => void }) {
  const { t } = useTranslation();
  const chip = "flex h-[46px] flex-none items-center gap-[9px] rounded-cc-md border px-[18px] text-[13.5px] whitespace-nowrap transition-[border-color,background-color,color]";
  const quiet = "border-cc-line bg-white/[.035] font-semibold text-cc-control hover:border-[rgba(167,139,250,.38)] hover:bg-white/[.06] hover:text-white";
  const caret = <span aria-hidden className="text-[10px] text-[#9c88bb]">▾</span>;
  return (
    <div className="-mx-4 -my-1 flex items-center gap-[10px] overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] min-[600px]:mx-[-2px] min-[600px]:flex-wrap min-[600px]:overflow-visible min-[600px]:px-[2px]">
      <button type="button" onClick={onProviders} className={cn(chip, quiet)}>{t("games.filter.providers")}{caret}</button>
      {(["popular", "newest"] as const).map((s) => (
        <button key={s} type="button" onClick={() => onSort(s)} className={cn(chip, quiet)}>{t(`games.sort.${s}`)}{caret}</button>
      ))}
      <span className="hidden min-w-2 flex-1 min-[600px]:block" />
      <button type="button" aria-pressed={favourites} onClick={onFavourites} className={cn(chip, "px-5 font-bold", favourites ? "border-[rgba(255,93,125,.5)] bg-[rgba(255,93,125,.16)] text-[#ff8da3]" : "border-[rgba(167,139,250,.16)] bg-white/[.025] text-[#b7a5d3] hover:text-white")}>
        <span aria-hidden className="text-[14px]">♥</span>{t("games.favouritesOnly")}
      </button>
    </div>
  );
}

function FavouritesRail({ onViewAll }: { onViewAll: () => void }) {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const { data = [] } = useFavourites();
  if (!signedIn || data.length === 0) {
    // Design: the section stays, with an invitation to use the ♥ (a guest's ♥ opens sign-in first).
    return (
      <section aria-label={t("games.favourites")} className="flex flex-col gap-[clamp(16px,2.4vw,22px)]">
        <SectionTitle>{t("games.favourites")}</SectionTitle>
        <div className="flex flex-col items-center gap-2 rounded-cc-xl border border-dashed border-[rgba(167,139,250,.26)] bg-white/[.02] px-[22px] py-[34px] text-center">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(255,93,125,.35)] bg-[rgba(255,93,125,.1)] text-[19px] text-[#ff8da3]">♡</span>
          <span className="text-[17px] font-extrabold text-cc-ink">{t("games.noFavouritesTitle")}</span>
          <span className="text-[13px] font-medium text-cc-lavender">{t("games.noFavouritesHint")}</span>
        </div>
      </section>
    );
  }
  return (
    <Rail title={t("games.favourites")} label={t("games.favourites")} arrows="games" action={<RailViewAll onClick={onViewAll}>{t("lobby.viewAll")}</RailViewAll>}>
      {data.map((g) => <GameCardTile key={g.id} game={g} variant="row" />)}
    </Rail>
  );
}

function PopularRail({ onViewAll }: { onViewAll: () => void }) {
  const { t } = useTranslation();
  const popular = useGames({ sort: "popular" }, 10);
  const games = popular.data?.pages[0]?.items ?? [];
  if (!popular.isPending && games.length === 0) return null;
  return (
    <Rail title={t("games.popular")} label={t("games.popular")} arrows="games" action={<RailViewAll onClick={onViewAll}>{t("lobby.viewAll")}</RailViewAll>}>
      {popular.isPending ? Array.from({ length: 5 }, (_, i) => <GameCardSkeleton key={i} variant="row" />) : games.map((g) => <GameCardTile key={g.id} game={g} variant="row" />)}
    </Rail>
  );
}

function ProvidersRail({ selected, onPick }: { selected?: string; onPick: (code: string) => void }) {
  const { t } = useTranslation();
  const { data: providers = [] } = useProviders();
  if (providers.length === 0) return null;
  return (
    <Rail id="game-providers" title={t("games.providers")} label={t("games.providers")} arrows="games">
      {providers.map((p) => {
        const on = selected === p.code;
        const mark = p.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
        return (
          <button
            key={p.code}
            type="button"
            aria-pressed={on}
            aria-label={t("lobby.categoryLabel", { name: p.name, count: p.gameCount })}
            onClick={() => onPick(p.code)}
            className={cn("flex h-[108px] min-w-[176px] flex-[1_1_176px] snap-start flex-col items-center justify-center gap-[7px] rounded-cc-xl border px-[18px] py-[14px] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[2px] hover:border-[rgba(167,139,250,.42)] hover:shadow-[0_12px_26px_rgba(0,0,0,.4)]", on ? "border-[rgba(255,201,60,.42)] bg-[linear-gradient(180deg,#2b1350_0%,#1c0b33_100%)]" : "border-cc-line bg-[linear-gradient(180deg,#23103f_0%,#180a2c_100%)]")}
          >
            {p.thumbnailUrl ? (
              <img src={p.thumbnailUrl} alt="" className="h-[30px] max-w-[120px] flex-none object-contain" />
            ) : (
              <span aria-hidden className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] border border-[rgba(167,139,250,.22)] bg-white/[.05] text-[11px] font-extrabold tracking-[.4px] text-[#b7a5d3]">{mark}</span>
            )}
            <span className={cn("text-[14.5px] leading-[1.15] font-extrabold tracking-[-0.2px] whitespace-nowrap", on ? "text-cc-gold-hover" : "text-cc-text")}>{p.name}</span>
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
  const filtered = Boolean(search.q || search.category || search.provider || search.badge || showFavourites);

  // The favourites-only view is the player's ♥ list (≤ 200, newest first) narrowed by the same filters, client-side.
  const favouriteCards = useMemo(() => (showFavourites ? filterFavourites(favourites.data ?? [], search) : []), [showFavourites, favourites.data, search]);
  const items = showFavourites ? favouriteCards : (games.data?.pages.flatMap((p) => p.items) ?? []);
  const total = showFavourites ? favouriteCards.length : (games.data?.pages[0]?.total ?? 0);
  const pending = showFavourites ? favourites.isPending : games.isPending;

  return (
    <section className="flex flex-col gap-[clamp(16px,2.4vw,22px)]" aria-labelledby="all-games">
      <div className="flex flex-wrap items-center gap-3">
        <span id="all-games" tabIndex={-1} className="scroll-mt-24 focus:outline-none"><SectionTitle count={pending ? undefined : t("games.count", { count: total })}>{showFavourites ? t("games.favourites") : search.badge === "hot" ? t("games.hotGames") : search.badge === "new" ? t("games.newGames") : t("games.allGames")}</SectionTitle></span>
        <span className="min-w-2 flex-1" />
        <button
          type="button"
          aria-label={t("games.sortLabel", { sort: t(`games.sort.${sort}`) })}
          onClick={() => set({ sort: nextSort === "popular" ? undefined : nextSort })}
          disabled={showFavourites}
          className="flex h-[46px] items-center gap-[9px] rounded-cc-md border border-cc-line bg-white/[.035] px-[18px] text-[13.5px] font-semibold whitespace-nowrap text-cc-control hover:border-[rgba(167,139,250,.38)] hover:bg-white/[.06] hover:text-white disabled:opacity-60"
        >
          {t("games.sortBy")} <span className="font-extrabold text-white">{t(`games.sort.${sort}`)}</span>
          <span aria-hidden className="text-[10px] text-[#9c88bb]">▾</span>
        </button>
      </div>

      {games.isError && !showFavourites ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}
      {!pending && items.length === 0 && !(games.isError && !showFavourites) ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[16px] border border-cc-line-strong bg-[rgba(167,139,250,.09)] px-[18px] py-[15px]">
          <span className="min-w-0 flex-[1_1_260px] text-[13px] leading-[1.5] font-semibold text-pretty text-cc-label">{showFavourites ? t("games.noFavourites") : filtered ? t("games.noMatch") : t("games.empty")}</span>
          {filtered ? (
            <button type="button" onClick={() => set({ q: undefined, category: undefined, provider: undefined, badge: undefined, fav: undefined })} className="min-h-11 rounded-[11px] border border-[rgba(167,139,250,.3)] bg-white/[.03] px-4 text-[13px] font-bold text-white hover:bg-white/[.08]">
              {t("games.clearFilters")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,132px),1fr))] gap-3 min-[600px]:grid-cols-[repeat(auto-fill,minmax(min(100%,142px),1fr))] min-[600px]:gap-[14px]">
        {pending ? Array.from({ length: 12 }, (_, i) => <GameCardSkeleton key={i} />) : items.map((g) => <GameCardTile key={g.id} game={g} />)}
      </div>

      {!showFavourites && games.hasNextPage ? (
        <Button
          className="h-[50px] self-center rounded-cc-lg border-[rgba(167,139,250,.32)] bg-[linear-gradient(180deg,#23103f_0%,#190a2c_100%)] px-[30px] text-[14.5px] text-white hover:border-[rgba(167,139,250,.6)] hover:bg-white/[.06] hover:shadow-[0_0_26px_rgba(139,92,246,.22)]"
          aria-label={t("games.loadMoreLabel", { shown: items.length, total })}
          onClick={() => void games.fetchNextPage()}
          loading={games.isFetchingNextPage}
        >
          {t("games.loadMore")} <span aria-hidden className="text-[13px] text-[#c4b5fd]">↓</span>
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
