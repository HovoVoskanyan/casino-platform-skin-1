import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useBanners, usePromotions, type Banner, type Promotion } from "./api";
import { isSiteLink } from "./banner-link";
import { splitPromotionValue } from "./promotion-value";

const ROTATE_MS = 7000;

/**
 * Design (Home hero): the `home-hero` placement at 2.360:1 (1956×829 desktop, 1134×480 phone — the preset P3-22
 * set), rotating every 7 s. Under the frame: the dots, ‹ › from 600px and a pause toggle (WCAG 2.2.2); swipe on
 * phones. A banner opens what the back office set (owner 2026-10-15): a page of the site by relative path
 * (`/games?category=slots`, `/vip`, `/wallet#deposit`) or, linked to a promotion, Promotions — where the back office's
 * bonuses are activated. A swipe that changes slide never also follows the link. Rotation stops for reduced motion.
 *
 * With no banner live, the design's own welcome artwork stands in — but only while the skin runs a `welcome`
 * promotion, whose amount fills the artwork's pill; the slide opens Promotions. Neither = no hero at all.
 */
export function HeroCarousel() {
  const { t } = useTranslation();
  const { data: banners = [], isPending } = useBanners("home-hero");
  const { data: promotions = [] } = usePromotions();
  const welcome = !isPending && banners.length === 0 ? promotions.find((p) => p.category === "welcome") : undefined;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Set when the finger travelled: the click a browser may still send after it must not follow the slide's link.
  const swipedRef = useRef(false);
  const count = banners.length;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused, reduced]);

  if (count === 0 && !welcome) return null;
  const current = count ? index % count : 0;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

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
        className="@container relative aspect-[321/136] touch-pan-y overflow-hidden rounded-[clamp(14px,2.2vw,20px)] border border-[rgba(167,139,250,.22)] bg-cc-surface shadow-[0_20px_50px_rgba(6,3,11,.6),inset_0_0_0_1px_rgba(255,255,255,.03)]"
      >
        {welcome ? <WelcomeSlide promotion={welcome} /> : banners.map((b, i) => <Slide key={b.id} banner={b} active={i === current} position={t("lobby.slideOf", { n: i + 1, count })} swipedRef={swipedRef} />)}
      </div>
      {count > 1 ? (
        <div role="group" aria-label={t("lobby.heroControls")} className="mx-4 mt-[6px] -mb-[14px] flex items-center justify-center gap-1">
          <ControlButton label={t("lobby.heroPrev")} onClick={() => go(-1)} className="mr-[6px] hidden min-[600px]:flex">‹</ControlButton>
          {banners.map((b, i) => (
            <button key={b.id} type="button" aria-label={t("lobby.showSlide", { n: i + 1, count })} aria-current={i === current ? "true" : undefined} onClick={() => setIndex(i)} className="flex items-center px-[3px] py-[14px]">
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

/** Where a slide goes: its page (a same-site path, checked again here), else Promotions for a promotion, else nowhere. */
const destination = (banner: Banner) => (isSiteLink(banner.linkUrl) ? banner.linkUrl.trim() : banner.promotionId ? "/promotions" : null);

function Slide({ banner, active, position, swipedRef }: { banner: Banner; active: boolean; position: string; swipedRef: RefObject<boolean> }) {
  const router = useRouter();
  const href = destination(banner);
  const picture = (
    <picture>
      {banner.mobileImageUrl ? <source media="(max-width: 599px)" srcSet={banner.mobileImageUrl} /> : null}
      <img src={banner.imageUrl} alt={banner.title ?? ""} width={banner.imageWidth ?? undefined} height={banner.imageHeight ?? undefined} className={cn("h-full w-full", banner.fit === "Contain" ? "object-contain" : "object-cover")} />
    </picture>
  );
  return (
    <div role="group" aria-roledescription="slide" aria-label={position} aria-hidden={!active} className={cn("absolute inset-0 transition-opacity duration-[550ms]", active ? "z-[2] opacity-100" : "pointer-events-none z-[1] opacity-0")}>
      {href ? (
        // A real <a href>: middle-click, ⌘-click and "copy link" behave as on any link; a plain click (or Enter) is
        // the router's own navigation — the path may carry a query and hash, so it goes in whole as `href`.
        <a
          href={href}
          tabIndex={active ? 0 : -1}
          aria-label={banner.title ?? position}
          className="block h-full w-full"
          draggable={false}
          onClick={(e: MouseEvent<HTMLAnchorElement>) => {
            if (swipedRef.current) { e.preventDefault(); swipedRef.current = false; return; }
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            void router.navigate({ href });
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
        <img src="/home-hero-welcome.webp" alt="" width={1926} height={816} className="h-full w-full object-cover" />
      </picture>
      <span aria-hidden className="absolute top-[50.6%] left-[7.6%] flex h-[17.6%] w-[43.2%] items-center justify-center gap-[1.4cqw] rounded-[3.4cqw] border-[0.24cqw] border-[#f5b62a] bg-[linear-gradient(180deg,#331363_0%,#1d0838_100%)] shadow-[0_0_2.4cqw_rgba(255,201,60,.35),inset_0_0_0_0.2cqw_rgba(0,0,0,.35)]">
        {peso ? <span className="text-[2.5cqw] font-extrabold tracking-[.06em] text-white [text-shadow:0_0.2cqw_0.5cqw_rgba(0,0,0,.6)]">{t("home.upTo")}</span> : null}
        <span className={cn("font-extrabold tracking-[-.01em] whitespace-nowrap", peso ? "text-[4.4cqw]" : "text-[2.8cqw]", " text-[#ffcf3f] [text-shadow:0_0.25cqw_0_#a35c00,0_0.5cqw_1.2cqw_rgba(0,0,0,.55)]")}>{peso ? amount : promotion.value}</span>
      </span>
    </Link>
  );
}
