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

export const Route = createFileRoute("/account")({ component: AccountPage });

const TABS = ["security", "sessions"] as const;

/**
 * Design (My Account): Profile · Security · Verification · Preferences · Bonuses. This increment ships the two tabs
 * identity already serves — Security (password, two-factor) and Sessions (the design's "Connected login methods"
 * neighbour). Profile, Verification and Preferences wait on P3-24 / P3-25 / P3-12.
 */
function AccountPage() {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]>("security");
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
            {tab === "security" ? <SecurityTab /> : <SessionsTab />}
          </div>
        </>
      ) : (
        <SignInGate title={t("account.gateTitle")} returnTo="/account" />
      )}
    </Shell>
  );
}
