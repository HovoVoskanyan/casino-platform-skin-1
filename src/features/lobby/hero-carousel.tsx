import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useBanners, type Banner } from "./api";

const ROTATE_MS = 6000;

/**
 * Design (Home hero): the `home-hero` placement at 2.360:1 (1956×829 desktop, 1134×480 phone — the preset P3-22
 * set), rotating every 6 s, with dots, a pause toggle (WCAG 2.2.2), swipe on phones and ‹ › on desktop. A banner
 * linked to a promotion opens that promotion's terms. No banners live = no hero at all, not an empty frame.
 * Rotation stops for users who ask for reduced motion.
 */
export function HeroCarousel() {
  const { t } = useTranslation();
  const { data: banners = [] } = useBanners("home-hero");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const count = banners.length;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused, reduced]);

  if (count === 0) return null;
  const current = index % count;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("lobby.heroLabel")}
      onTouchStart={(e) => { const p = e.touches[0]; if (p) touch.current = { x: p.clientX, y: p.clientY }; }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const p = e.changedTouches[0];
        touch.current = null;
        if (!start || !p) return;
        const dx = p.clientX - start.x;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(p.clientY - start.y)) go(dx < 0 ? 1 : -1);
      }}
      className="relative -mt-3 aspect-[2360/1000] touch-pan-y overflow-hidden rounded-[clamp(14px,2.2vw,20px)] border border-[rgba(167,139,250,.22)] bg-cc-surface shadow-[0_20px_50px_rgba(6,3,11,.6)]"
    >
      {banners.map((b, i) => (
        <Slide key={b.id} banner={b} active={i === current} position={t("lobby.slideOf", { n: i + 1, count })} />
      ))}
      {count > 1 ? (
        <>
          <button type="button" aria-label={t("lobby.heroPrev")} onClick={() => go(-1)} className="absolute top-1/2 left-3 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[rgba(9,3,16,.5)] text-[18px] font-bold text-white backdrop-blur-sm hover:border-[rgba(255,201,60,.6)] md:flex">‹</button>
          <button type="button" aria-label={t("lobby.heroNext")} onClick={() => go(1)} className="absolute top-1/2 right-3 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[rgba(9,3,16,.5)] text-[18px] font-bold text-white backdrop-blur-sm hover:border-[rgba(255,201,60,.6)] md:flex">›</button>
          <div className="absolute inset-x-0 bottom-[clamp(8px,2vw,14px)] flex items-center justify-center gap-2">
            {banners.map((b, i) => (
              <button key={b.id} type="button" aria-label={t("lobby.showSlide", { n: i + 1, count })} aria-current={i === current ? "true" : undefined} onClick={() => setIndex(i)} className="flex h-6 items-center px-[2px]">
                <span className={cn("block h-2 rounded-full transition-[width,background-color]", i === current ? "w-6 bg-cc-gold shadow-[0_0_12px_rgba(255,201,60,.7)]" : "w-2 bg-white/30")} />
              </button>
            ))}
            <button type="button" aria-label={paused ? t("lobby.heroResume") : t("lobby.heroPause")} aria-pressed={paused} onClick={() => setPaused((p) => !p)} className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(255,201,60,.18)] text-[9px] text-white">
              {paused ? "▶" : "❚❚"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Slide({ banner, active, position }: { banner: Banner; active: boolean; position: string }) {
  const picture = (
    <picture>
      {banner.mobileImageUrl ? <source media="(max-width: 599px)" srcSet={banner.mobileImageUrl} /> : null}
      <img src={banner.imageUrl} alt={banner.title ?? ""} width={banner.imageWidth ?? undefined} height={banner.imageHeight ?? undefined} className={cn("h-full w-full", banner.fit === "Contain" ? "object-contain" : "object-cover")} />
    </picture>
  );
  return (
    <div role="group" aria-roledescription="slide" aria-label={position} aria-hidden={!active} className={cn("absolute inset-0 transition-opacity duration-500", active ? "opacity-100" : "pointer-events-none opacity-0")}>
      {banner.promotionId ? (
        <Link to="/promotions" search={{ promo: banner.promotionId }} tabIndex={active ? 0 : -1} aria-label={banner.title ?? position} className="block h-full w-full">
          {picture}
        </Link>
      ) : (
        picture
      )}
    </div>
  );
}
