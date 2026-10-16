import { useTranslation } from "react-i18next";
import { SectionTitle } from "@/components/ui/section-title";
import { SupportButton } from "@/features/support/support-button";
import { cn } from "@/lib/utils";

/**
 * Design (Home): the GCash / Maya panel and the trust strip. Static marketing copy — the methods themselves are
 * payments' list and the cashier's job; this only says which wallets the site takes.
 */
export function PaymentsPanel() {
  const { t } = useTranslation();
  const wallets = [
    { key: "gcash", img: "/gcash.jpg", name: "GCash", card: "border-[rgba(56,189,248,.3)] bg-[linear-gradient(150deg,rgba(0,125,240,.22)_0%,rgba(11,6,26,.95)_70%)]", logo: "bg-[linear-gradient(150deg,#0a8ef5,#0059c2)] shadow-[0_6px_16px_rgba(0,90,200,.32)]", points: ["home.gcash.1", "home.gcash.2", "home.gcash.3"] },
    { key: "maya", img: "/maya.jpg", name: "Maya", card: "border-[rgba(52,211,153,.28)] bg-[linear-gradient(150deg,rgba(16,185,129,.18)_0%,rgba(11,6,26,.95)_70%)]", logo: "border border-[rgba(52,211,153,.25)] bg-black", points: ["home.maya.1", "home.maya.2", "home.maya.3"] },
  ];
  return (
    <section className="flex flex-col gap-4" aria-labelledby="payments-title">
      <span id="payments-title"><SectionTitle>{t("home.payments")}</SectionTitle></span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3">
        {wallets.map((w) => (
          <div key={w.key} className={cn("flex items-center gap-3 rounded-cc-lg border p-[10px]", w.card)}>
            <div className={cn("flex h-[58px] w-24 flex-none items-center justify-center overflow-hidden rounded-cc", w.logo)}>
              <img src={w.img} alt={w.name} className="h-full w-full object-contain" />
            </div>
            <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-[5px] p-0">
              {w.points.map((p) => (
                <li key={p} className="flex items-center gap-[7px] text-[12.5px] font-semibold text-cc-label">
                  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none"><path d="M4 12.5l5 5L20 6.5" /></svg>
                  {t(p)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The design's line-art trust marks (Games page). */
const TRUST_PATHS: Record<string, string> = {
  secure: "M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z",
  fast: "M13 3L5 13.5h5L9.5 21 18 10h-5l1-7z",
  anywhere: "M3 5h12v10H3zM17 9h4v11h-4zM7 19h6",
  support: "M4 13v-1a8 8 0 0116 0v1m-16 0v3a2 2 0 002 2h1v-6H6a2 2 0 00-2 2zm16 0v3a2 2 0 01-2 2h-1v-6h1a2 2 0 012 2z",
};

/**
 * Design (Home / Games foot): the trust strip — Home's three 3D marks, the Games page's four line marks with a
 * sub-line each — closed by the Caveat "Tuloy ang Good Vibes ♥". Stacked under 600px, dividers between from 600px.
 */
export function TrustStrip({ variant = "home", className }: { variant?: "home" | "games"; className?: string }) {
  const { t } = useTranslation();
  const games = variant === "games";
  const items = games
    ? [{ key: "secure" }, { key: "fast" }, { key: "anywhere" }, { key: "support" }]
    : [{ key: "secure", img: "/icon-shield.webp" }, { key: "fast", img: "/icon-bolt.webp" }, { key: "support", img: "/icon-headset.webp" }];
  return (
    <section
      aria-label={t("home.trust")}
      className={cn(
        "flex flex-wrap items-center gap-[10px] rounded-cc-xl border border-[rgba(167,139,250,.16)] bg-[linear-gradient(180deg,rgba(255,255,255,.045)_0%,rgba(255,255,255,.02)_100%)] px-4 py-[14px] min-[600px]:gap-4",
        games ? "min-[600px]:px-6 min-[600px]:py-5" : "min-[600px]:px-[clamp(16px,2.6vw,24px)] min-[600px]:py-[clamp(16px,2.4vw,20px)]",
        className,
      )}
    >
      <div className={cn("grid min-w-0 gap-2 min-[600px]:gap-[6px]", games ? "flex-[1_1_min(100%,700px)] min-[600px]:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]" : "flex-[1_1_min(100%,480px)] min-[600px]:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]")}>
        {items.map((i, n) => {
          const tile = (
            <>
              {"img" in i ? (
                <span className="flex h-10 w-10 flex-none items-center justify-center"><img src={i.img} alt="" className="h-[38px] w-[38px] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.85)]" /></span>
              ) : (
                <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-cc border border-[rgba(255,201,60,.2)] bg-[rgba(167,139,250,.12)]">
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cc-gold)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={TRUST_PATHS[i.key]} /></svg>
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-[3px] text-left">
                <span className="text-[14px] font-bold whitespace-nowrap text-cc-ink">{t(`home.trust.${i.key}`)}</span>
                {games ? <span className="text-[12px] leading-[1.35] font-medium whitespace-nowrap text-cc-lavender">{t(`home.trust.${i.key}.sub`)}</span> : null}
              </span>
            </>
          );
          const cls = cn("flex min-w-0 items-center gap-[11px] py-[2px] min-[600px]:border-l min-[600px]:border-[rgba(167,139,250,.16)]", games ? "min-[600px]:px-[10px] min-[600px]:py-[6px]" : "min-[600px]:px-4", n === 0 && "min-[600px]:border-l-transparent");
          // The support tile opens the support panel (P3-31); the others are statements.
          return i.key === "support" ? (
            <SupportButton key={i.key} className={cn(cls, "rounded-cc hover:bg-white/[.03]")}>{tile}</SupportButton>
          ) : (
            <div key={i.key} className={cls}>{tile}</div>
          );
        })}
      </div>
      <span className={cn("flex flex-[1_1_100%] items-center gap-2 font-brand font-bold whitespace-nowrap text-[#e9a832] min-[600px]:ml-auto min-[600px]:flex-none", games ? "text-[20px]" : "text-[22px]")}>
        {t("shell.tagline")} <span aria-hidden className="text-[15px] text-cc-rose">♥</span>
      </span>
    </section>
  );
}
