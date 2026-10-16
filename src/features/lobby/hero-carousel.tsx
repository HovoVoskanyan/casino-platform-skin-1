import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useBanners, usePromotions, type Banner, type Promotion } from "./api";
import { isExternalLink, isSiteLink } from "./banner-link";
import { splitPromotionValue } from "./promotion-value";

/** Owner 2026-10-15: three seconds a slide — the hero moves quickly. */
const ROTATE_MS = 3000;

/** The banner frame — the same box while the banners are still on their way, so nothing below it moves when they land. */
const FRAME = "@container relative aspect-[321/136] touch-pan-y overflow-hidden rounded-[clamp(14px,2.2vw,20px)] border border-[rgba(167,139,250,.22)] bg-cc-surface shadow-[0_20px_50px_rgba(6,3,11,.6),inset_0_0_0_1px_rgba(255,255,255,.03)]";

/** What the frame shows until the shown picture has loaded: the skins' loading pulse (still for reduced motion). */
const SKELETON = <span aria-hidden className="absolute inset-0 bg-white/[.04] motion-safe:animate-pulse" />;

/**
 * Design (Home hero): the `home-hero` placement at 2.360:1 (1956×829 desktop, 1134×480 phone — the preset P3-22
 * set), rotating every 3 s. Under the frame: the dots, ‹ › from 600px and a pause toggle (WCAG 2.2.2); swipe on
 * phones. A banner opens what the back office set (owner 2026-10-15): a page of the site by relative path
 * (`/games?category=slots`, `/vip`, `/wallet#deposit`), another website by https address (2026-10-16 — in a new tab,
 * marked ↗, `rel` sponsored), or, linked to a promotion, Promotions — where the back office's bonuses are activated.
 * A swipe that changes slide never also follows the link. Rotation stops for reduced motion.
 *
 * Slow networks (owner 2026-10-16): only the shown slide's picture is in the page at first, fetched at high priority;
 * the next one is added once the shown one has loaded, so they never all download at once. Until the shown picture
 * has loaded the frame pulses, then the picture fades in. The 3 s count starts when a slide is actually on screen,
 * and rotation waits for the next picture rather than moving to a blank slide; one that fails to load is skipped.
 *
 * With no banner live, the design's own welcome artwork stands in — but only while the skin runs a `welcome`
 * promotion, whose amount fills the artwork's pill; the slide opens Promotions. Neither = no hero at all.
 */
export function HeroCarousel() {
  const { t } = useTranslation();
  const { data: banners = [], isPending } = useBanners("home-hero");
  const { data: promotions = [], isPending: promotionsPending } = usePromotions();
  const welcome = !isPending && banners.length === 0 ? promotions.find((p) => p.category === "welcome") : undefined;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Per banner id: its picture loaded, or failed to. No entry = still on its way (or not asked for yet).
  const [settled, setSettled] = useState<Record<string, "loaded" | "failed">>({});
  // The banner whose 3 s on screen are up while the next picture was still loading: rotation moves on when it lands.
  const [due, setDue] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Set when the finger travelled: the click a browser may still send after it must not follow the slide's link.
  const swipedRef = useRef(false);
  const count = banners.length;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const current = count ? index % count : 0;
  const shownId = banners[current]?.id;
  const shown = shownId ? settled[shownId] : undefined;
  // Where rotation goes next: the following banner whose picture has not failed (none → no rotation).
  const nextIndex = count < 2 ? null : (Array.from({ length: count - 1 }, (_, k) => (current + 1 + k) % count).find((i) => settled[banners[i]!.id] !== "failed") ?? null);
  const nextId = nextIndex === null ? undefined : banners[nextIndex]!.id;
  // A slide's picture is in the page once it is shown, or is next after a shown one that has settled — and stays once
  // it has settled itself, so nothing is fetched twice.
  const withPicture = (id: string) => id === shownId || settled[id] !== undefined || (!!shown && id === nextId);

  const advance = () => {
    if (nextIndex === null) return;
    setDue(null);
    setIndex(nextIndex);
  };
  // The shown slide's 3 s are up: on to the next if its picture is ready, else as soon as it is (see settle).
  const onDue = useEffectEvent(() => {
    if (nextId && settled[nextId] === "loaded") advance();
    else if (shownId) setDue(shownId);
  });

  useEffect(() => {
    if (nextIndex === null || paused || reduced || !shown) return;
    const id = window.setTimeout(onDue, ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [shownId, shown, nextIndex, paused, reduced]);

  // Still asking core (on a slow network, a while): the empty frame holds the hero's place. Not the carousel yet — it
  // may yet turn out to have nothing to show.
  if (isPending || (count === 0 && promotionsPending)) return <div aria-hidden className={cn(FRAME, "-mt-3")}>{SKELETON}</div>;
  if (count === 0 && !welcome) return null;
  const go = (delta: number) => { setDue(null); setIndex((i) => (i + delta + count) % count); };
  const settle = (id: string, result: "loaded" | "failed") => {
    setSettled((s) => (s[id] === result ? s : { ...s, [id]: result }));
    if (result === "loaded" && id === nextId && due !== null && due === shownId && !paused) advance();
  };

  return (
    <section aria-roledescription="carousel" aria-label={t("lobby.heroLabel")} className="-mt-3 flex flex-col">
      <div
        onTouchStart={(e) => { const p = e.touches[0]; swipedRef.current = false; if (p) touch.current = { x: p.clientX, y: p.clientY }; }}
        onTouchEnd={(e) => {
          const start = touch.current;
          const p = e.changedTouches[0];
          touch.current = null;
          if (!start || !p) return;
          const dx = p.clientX - start.x;
          if (Math.hypot(dx, p.clientY - start.y) > 10) swipedRef.current = true;
          if (count < 2) return;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(p.clientY - start.y)) go(dx < 0 ? 1 : -1);
        }}
        className={FRAME}
      >
        {!welcome && shown !== "loaded" ? SKELETON : null}
        {welcome ? <WelcomeSlide promotion={welcome} /> : banners.map((b, i) => (
          <Slide
            key={b.id}
            banner={b}
            active={i === current}
            first={i === 0}
            picture={withPicture(b.id)}
            loaded={settled[b.id] === "loaded"}
            onSettled={(result) => settle(b.id, result)}
            position={t("lobby.slideOf", { n: i + 1, count })}
            swipedRef={swipedRef}
          />
        ))}
      </div>
      {count > 1 ? (
        <div role="group" aria-label={t("lobby.heroControls")} className="mx-4 mt-[6px] -mb-[14px] flex items-center justify-center gap-1">
          <ControlButton label={t("lobby.heroPrev")} onClick={() => go(-1)} className="mr-[6px] hidden min-[600px]:flex">‹</ControlButton>
          {banners.map((b, i) => (
            <button key={b.id} type="button" aria-label={t("lobby.showSlide", { n: i + 1, count })} aria-current={i === current ? "true" : undefined} onClick={() => { setDue(null); setIndex(i); }} className="flex items-center px-[3px] py-[14px]">
              <span className={cn("block h-2 rounded-full transition-[width,background-color] duration-[250ms]", i === current ? "w-6 bg-cc-gold shadow-[0_0_12px_rgba(255,201,60,.7)]" : "w-2 bg-white/[.28]")} />
            </button>
          ))}
          <ControlButton label={t("lobby.heroNext")} onClick={() => go(1)} className="ml-[6px] hidden min-[600px]:flex">›</ControlButton>
          <ControlButton label={paused ? t("lobby.heroResume") : t("lobby.heroPause")} pressed={paused} onClick={() => setPaused((p) => !p)} className="ml-[6px] flex text-[12px] tracking-[-1px]">
            {paused ? "▶" : "❚❚"}
          </ControlButton>
        </div>
      ) : null}
    </section>
  );
}

function ControlButton({ label, pressed, onClick, className, children }: { label: string; pressed?: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className={cn("h-9 w-9 flex-none items-center justify-center rounded-full border border-cc-line-strong bg-white/[.04] text-[16px] font-bold text-cc-gold-hover hover:bg-[rgba(255,201,60,.18)] hover:text-white", className)}>
      {children}
    </button>
  );
}

/**
 * Where a slide goes: its page (a same-site path, checked again here), another website (a public https address,
 * likewise), else Promotions for a promotion, else nowhere — a link that passes neither check is never rendered.
 */
function destination(banner: Banner): { href: string; external: boolean } | null {
  const link = (banner.linkUrl ?? "").trim();
  if (isSiteLink(link)) return { href: link, external: false };
  if (isExternalLink(link)) return { href: link, external: true };
  return banner.promotionId ? { href: "/promotions", external: false } : null;
}

type SlideProps = {
  banner: Banner;
  active: boolean;
  /** The carousel's first banner — the page's largest picture, so it is fetched ahead of everything else. */
  first: boolean;
  /** False until the carousel asks for this slide's picture: the slide (and its link) is there, the download is not. */
  picture: boolean;
  loaded: boolean;
  onSettled: (result: "loaded" | "failed") => void;
  position: string;
  swipedRef: RefObject<boolean>;
};

function Slide({ banner, active, first, picture: withPicture, loaded, onSettled, position, swipedRef }: SlideProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const target = destination(banner);
  const name = banner.title ?? position;
  const picture = withPicture ? (
    <picture>
      {banner.mobileImageUrl ? <source media="(max-width: 599px)" srcSet={banner.mobileImageUrl} /> : null}
      <img
        src={banner.imageUrl}
        alt={banner.title ?? ""}
        width={banner.imageWidth ?? undefined}
        height={banner.imageHeight ?? undefined}
        fetchPriority={first ? "high" : active ? "auto" : "low"}
        decoding="async"
        draggable={false}
        onLoad={() => onSettled("loaded")}
        onError={() => onSettled("failed")}
        className={cn("h-full w-full transition-opacity duration-[400ms]", banner.fit === "Contain" ? "object-contain" : "object-cover", loaded ? "opacity-100" : "opacity-0")}
      />
    </picture>
  ) : null;
  return (
    <div role="group" aria-roledescription="slide" aria-label={position} aria-hidden={!active} className={cn("absolute inset-0 transition-opacity duration-[550ms]", active ? "z-[2] opacity-100" : "pointer-events-none z-[1] opacity-0")}>
      {target?.external ? (
        // Another website: the browser's own new tab. noopener/noreferrer — the partner gets neither this window nor
        // the page it came from; sponsored/nofollow — search engines are told it is a paid placement.
        <a
          href={target.href}
          target="_blank"
          rel="noopener noreferrer sponsored nofollow"
          tabIndex={active ? 0 : -1}
          aria-label={`${name} ${t("info.opensNewTab")}`}
          className="relative block h-full w-full"
          draggable={false}
          onClick={(e: MouseEvent<HTMLAnchorElement>) => {
            if (swipedRef.current) { e.preventDefault(); swipedRef.current = false; }
          }}
        >
          {picture}
          <span aria-hidden className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-[rgba(6,3,11,.55)] text-white shadow-[0_2px_8px_rgba(0,0,0,.4)] backdrop-blur-sm min-[600px]:top-3 min-[600px]:right-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
          </span>
        </a>
      ) : target ? (
        // A real <a href>: middle-click, ⌘-click and "copy link" behave as on any link; a plain click (or Enter) is
        // the router's own navigation — the path may carry a query and hash, so it goes in whole as `href`.
        <a
          href={target.href}
          tabIndex={active ? 0 : -1}
          aria-label={name}
          className="block h-full w-full"
          draggable={false}
          onClick={(e: MouseEvent<HTMLAnchorElement>) => {
            if (swipedRef.current) { e.preventDefault(); swipedRef.current = false; return; }
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            void router.navigate({ href: target.href });
          }}
        >
          {picture}
        </a>
      ) : (
        picture
      )}
    </div>
  );
}

/** The design's slide 1: its artwork, the pill re-lettered with the live offer's amount (the art's own reads ₹). */
function WelcomeSlide({ promotion }: { promotion: Promotion }) {
  const { t } = useTranslation();
  const { amount } = promotion.value ? splitPromotionValue(promotion.value) : { amount: "" };
  const peso = amount.startsWith("₱");
  return (
    <Link to="/promotions" aria-label={[promotion.title, promotion.value].filter(Boolean).join(" — ")} className="absolute inset-0 block">
      <picture>
        <source media="(max-width: 599px)" srcSet="/home-hero-welcome-sm.webp" />
        <img src="/home-hero-welcome.webp" alt="" width={1926} height={816} fetchPriority="high" className="h-full w-full object-cover" />
      </picture>
      <span aria-hidden className="absolute top-[50.6%] left-[7.6%] flex h-[17.6%] w-[43.2%] items-center justify-center gap-[1.4cqw] rounded-[3.4cqw] border-[0.24cqw] border-[#f5b62a] bg-[linear-gradient(180deg,#331363_0%,#1d0838_100%)] shadow-[0_0_2.4cqw_rgba(255,201,60,.35),inset_0_0_0_0.2cqw_rgba(0,0,0,.35)]">
        {peso ? <span className="text-[2.5cqw] font-extrabold tracking-[.06em] text-white [text-shadow:0_0.2cqw_0.5cqw_rgba(0,0,0,.6)]">{t("home.upTo")}</span> : null}
        <span className={cn("font-extrabold tracking-[-.01em] whitespace-nowrap", peso ? "text-[4.4cqw]" : "text-[2.8cqw]", " text-[#ffcf3f] [text-shadow:0_0.25cqw_0_#a35c00,0_0.5cqw_1.2cqw_rgba(0,0,0,.55)]")}>{peso ? amount : promotion.value}</span>
      </span>
    </Link>
  );
}
