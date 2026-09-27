import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Shell } from "@/components/layout/shell";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import { SignInGate } from "@/features/auth/sign-in-gate";
import { useSession } from "@/features/auth/session";
import { SecurityTab } from "@/features/account/security-tab";
import { SessionsTab } from "@/features/account/sessions-tab";
import { ProfileTab } from "@/features/account/profile-tab";

export const Route = createFileRoute("/account")({ component: AccountPage });

const TABS = ["profile", "security", "sessions"] as const;

/**
 * Design (My Account): Profile · Security · Verification · Preferences · Bonuses. Profile (P3-24: player number,
 * display name, city — core), Security (contacts pending until confirmed, sign-in methods, password, two-factor —
 * identity) and Sessions. Verification is off for ChoCho (owner 2026-09-25); Preferences and Bonuses wait on their cards.
 */
function AccountPage() {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]>("profile");
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
            {tab === "profile" ? <ProfileTab /> : tab === "security" ? <SecurityTab /> : <SessionsTab />}
          </div>
        </>
      ) : (
        <SignInGate title={t("account.gateTitle")} returnTo="/account" />
      )}
    </Shell>
  );
}
