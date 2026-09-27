import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { useSession } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { BalanceMenu } from "@/features/wallet/balance-menu";

const NAV = [
  { key: "games", to: "/games" },
  { key: "promotions", to: "/promotions" },
  { key: "vip", to: "/vip" },
] as const;

/**
 * Design (Header): sticky 76px bar — logo, Games | Promotions | VIP | Help, one secondary "Aviator" chip, then either
 * Sign in + gold Register (guest) or Balance + Deposit + avatar (signed in). Collapses to the compact bar under
 * 760px with a burger menu. The balance is live from core's hub (P3-28, `BalanceMenu`); "—" while it is unknown,
 * never a number that could be stale.
 */
export function Header() {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const current = path + (typeof window !== "undefined" ? window.location.search : "");

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(167,139,250,.16)] bg-[linear-gradient(180deg,rgba(29,12,53,.96)_0%,rgba(15,6,27,.96)_100%)] shadow-[0_10px_30px_rgba(6,3,11,.55)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[66px] max-w-[1024px] items-center gap-2 px-4 py-[10px] md:min-h-[76px] md:px-[22px] md:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" aria-label={t("nav.home")} className="block flex-none">
            <img src="/chocho-logo-cut.png" alt="ChoCho" className="block h-10 w-[58px] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,.5)] md:h-[50px] md:w-[72px]" />
          </Link>
          <nav className="hidden items-center gap-[2px] md:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = path.startsWith(item.to);
              return (
                <Link key={item.key} to={item.to} className={cn("relative flex h-10 items-center rounded-cc px-[14px] text-[15px] font-semibold whitespace-nowrap hover:bg-white/[.05] hover:text-cc-ink", active ? "text-cc-ink" : "text-[#bfaed8]")}>
                  {t(`nav.${item.key}`)}
                  <span aria-hidden className={cn("absolute bottom-[3px] left-[14px] right-[14px] h-[2.5px] rounded-full bg-[#f0a30a] shadow-[0_0_10px_rgba(240,163,10,.7)]", active ? "opacity-100" : "opacity-0")} />
                </Link>
              );
            })}
            <a href="/#support" className="flex h-10 items-center rounded-cc px-[14px] text-[15px] font-semibold text-[#bfaed8] hover:bg-white/[.05] hover:text-cc-ink">{t("nav.help")}</a>
          </nav>
        </div>

        <div className="min-w-2 flex-1" />

        {signedIn ? (
          <>
            <BalanceMenu />
            <Button asChild variant="primary" size="md" className="hidden md:inline-flex"><Link to="/wallet" hash="deposit">{t("nav.deposit")}</Link></Button>
            <Link to="/account" aria-label={t("nav.myAccount")} className="flex h-10 w-10 flex-none items-center justify-center rounded-cc border border-cc-line-strong bg-white/[.04] text-[13px] font-extrabold text-cc-text">
              <UserGlyph />
            </Link>
          </>
        ) : (
          <>
            <Button variant="secondary" size="md" className="min-w-0 px-3 md:min-w-[108px] md:px-4" onClick={() => authDialog.open("signin", current)}>{t("nav.signIn")}</Button>
            <Button variant="primary" size="md" className="px-[14px] md:px-6" onClick={() => authDialog.open("register", current)}>{t("nav.register")}</Button>
          </>
        )}

        <button type="button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="flex h-10 w-10 flex-none items-center justify-center rounded-cc border border-cc-line-strong bg-white/[.02] text-cc-text md:hidden">☰</button>
      </div>

      {menuOpen ? (
        <nav aria-label="Menu" className="mx-auto grid max-w-[1024px] gap-1 px-4 pb-4 md:hidden">
          {NAV.map((item) => (
            <Link key={item.key} to={item.to} onClick={() => setMenuOpen(false)} className="flex h-11 items-center rounded-cc px-3 text-[15px] font-semibold text-cc-text hover:bg-white/[.05]">{t(`nav.${item.key}`)}</Link>
          ))}
          <Link to="/wallet" onClick={() => setMenuOpen(false)} className="flex h-11 items-center rounded-cc px-3 text-[15px] font-semibold text-cc-text hover:bg-white/[.05]">{t("nav.wallet")}</Link>
          <Link to="/account" onClick={() => setMenuOpen(false)} className="flex h-11 items-center rounded-cc px-3 text-[15px] font-semibold text-cc-text hover:bg-white/[.05]">{t("nav.myAccount")}</Link>
        </nav>
      ) : null}
    </header>
  );
}

function UserGlyph() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" />
    </svg>
  );
}
