import type { ReactNode } from "react";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";

/** Design (UI Foundations): the canvas gradient behind a 1024px column, 26–30px between sections, 150px of room at the end for the bottom nav. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center">
      <div className="flex w-full max-w-[1024px] min-w-0 flex-col gap-[clamp(26px,4vw,30px)]">
        <Header />
        <main className="flex flex-col gap-[clamp(26px,4vw,30px)] px-4 md:px-[22px]">{children}</main>
        <Footer />
      </div>
      <BottomNav />
    </div>
  );
}

/** Design (Games/Promotions/VIP heroes): HTML hero with the brand logo as decoration, no banner file. */
export function PageHero({ title, subtitle, children }: { title: ReactNode; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="flex flex-wrap items-center gap-6 rounded-[20px] border border-cc-line bg-[radial-gradient(80%_120%_at_10%_0%,rgba(122,52,205,.35),transparent_60%),linear-gradient(180deg,#23103f_0%,#150726_100%)] px-4 py-[18px] md:px-[26px] md:py-6">
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
        <h1 className="m-0 text-[28px] font-extrabold leading-[1.1] tracking-[-0.8px] text-cc-ink md:text-[34px]">{title}</h1>
        {subtitle ? <p className="m-0 text-[14px] font-medium leading-[1.5] text-cc-lavender">{subtitle}</p> : null}
        {children}
        <span className="font-brand text-[20px] font-bold text-[#e9a832]">Tuloy ang Good Vibes</span>
      </div>
      <img src="/chocho-logo-cut.png" alt="" className="hidden max-h-[164px] w-[152px] flex-none object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,.5)] md:block" />
    </section>
  );
}
