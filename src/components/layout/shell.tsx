import type { ReactNode } from "react";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";

/** Design (UI Foundations): the canvas gradient behind a 1024px column, 26–30px between sections, 150px of room at the end for the bottom nav. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center">
      <div className="flex w-full max-w-[1024px] min-w-0 flex-col gap-[clamp(26px,4vw,30px)]">
        <Header />
        <main className="flex flex-col gap-[clamp(26px,4vw,30px)] px-[clamp(16px,2.4vw,22px)]">{children}</main>
        <Footer />
      </div>
      <BottomNav />
    </div>
  );
}

/**
 * Design (Games/Promotions/VIP heroes): an HTML hero, no banner file — title, subtitle and the page's control on the
 * left; the brand logo in a soft glow with the Caveat tagline under it on the right. Under 600px the logo goes (the
 * header carries the brand) and the tagline drops under the content.
 */
export function PageHero({ title, subtitle, logoWidth = 152, children }: { title: ReactNode; subtitle?: string; logoWidth?: number; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[rgba(167,139,250,.22)] bg-cc-surface shadow-[0_20px_50px_rgba(6,3,11,.6),inset_0_0_0_1px_rgba(255,255,255,.03)]">
      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(65%_100%_at_88%_45%,rgba(167,139,250,.2)_0%,transparent_70%),radial-gradient(45%_75%_at_4%_0%,rgba(124,58,237,.16)_0%,transparent_72%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-[10px] px-4 py-[18px] min-[600px]:px-[26px] min-[600px]:py-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
          <h1 className="m-0 text-[28px] font-extrabold leading-[1.1] tracking-[-0.8px] text-cc-ink min-[600px]:text-[34px]">{title}</h1>
          {subtitle ? <p className="m-0 text-[14px] font-medium leading-[1.5] text-pretty text-cc-lavender">{subtitle}</p> : null}
          {children}
        </div>
        <div className="relative flex min-w-0 flex-[1_1_100%] flex-col items-start gap-[2px] min-[600px]:-ml-2 min-[600px]:flex-[0_1_186px] min-[600px]:items-center">
          <span aria-hidden className="pointer-events-none absolute top-[44%] left-1/2 hidden h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,.26)_0%,rgba(240,163,10,.14)_42%,transparent_70%)] blur-[6px] min-[600px]:block" />
          <img src="/chocho-logo.webp" srcSet="/chocho-logo-sm.webp 160w, /chocho-logo.webp 360w" sizes={`${logoWidth}px`} width={360} height={340} alt="" style={{ maxWidth: logoWidth }} className="relative hidden w-full object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,.5)] min-[600px]:block" />
          <span className="relative font-brand text-[19px] font-bold whitespace-nowrap text-[#e9a832]">Tuloy ang Good Vibes</span>
        </div>
      </div>
    </section>
  );
}
