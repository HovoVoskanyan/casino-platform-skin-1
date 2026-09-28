import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import { SignInGate } from "@/features/auth/sign-in-gate";
import { useSession } from "@/features/auth/session";
import { SecurityTab } from "@/features/account/security-tab";
import { SessionsTab } from "@/features/account/sessions-tab";
import { ProfileTab } from "@/features/account/profile-tab";
import { Bonuses } from "@/features/bonus/bonuses";

const TABS = ["profile", "security", "sessions", "bonuses"] as const;
type Tab = (typeof TABS)[number];

/** `?tab=bonuses` (the design's FAQ links into My Account name a tab); anything else opens Profile. */
export const Route = createFileRoute("/account")({
  component: AccountPage,
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = String(search.tab ?? "").toLowerCase();
    return (TABS as readonly string[]).includes(tab) ? { tab: tab as Tab } : {};
  },
});

/**
 * Design (My Account): Profile · Security · Verification · Preferences · Bonuses. Profile (P3-24: player number,
 * display name, city — core), Security (contacts pending until confirmed, sign-in methods, password, two-factor —
 * identity), Sessions and Bonuses (P3-29: the bonuses component, page variant). Verification is off for ChoCho (owner
 * 2026-09-25); Preferences waits on its card.
 */
function AccountPage() {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  // The tab IS the URL (review F7): a link to ?tab=bonuses switches it even on this page, and a reload keeps it.
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: Tab = search.tab ?? "profile";
  const setTab = (next: Tab) => void navigate({ search: next === "profile" ? {} : { tab: next }, replace: true });
  return (
    <Shell>
      {signedIn ? (
        <>
          <SectionTitle>{t("account.title")}</SectionTitle>
          <p className="-mt-3 text-[14px] text-cc-lavender">{t("account.subtitle")}</p>
          <div role="tablist" className="flex gap-2 overflow-x-auto">
            {TABS.map((key) => (
              <button key={key} role="tab" type="button" aria-selected={tab === key} aria-controls={`panel-${key}`} id={`tab-${key}`} onClick={() => setTab(key)} className={cn("h-[42px] flex-none rounded-cc border px-4 text-[13.5px] font-bold transition-colors", tab === key ? "border-[rgba(255,201,60,.5)] bg-[image:var(--cc-gold-cta)] text-[#2c1400]" : "border-cc-line-strong bg-white/[.03] text-[#bfaed8]")}>
                {t(`account.tab.${key}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "profile" ? <ProfileTab /> : tab === "security" ? <SecurityTab /> : tab === "bonuses" ? <Bonuses variant="page" /> : <SessionsTab />}
          </div>
        </>
      ) : (
        <SignInGate title={t("account.gateTitle")} returnTo={search.tab ? `/account?tab=${search.tab}` : "/account"} />
      )}
    </Shell>
  );
}
