import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { SectionTitle } from "@/components/ui/section-title";
import { Notice } from "@/components/ui/notice";
import { SignInGate } from "@/features/auth/sign-in-gate";
import { useSession } from "@/features/auth/session";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

/** Design (Wallet): a guest sees the sign-in gate and no personal data. The balance card and transactions arrive with the cashier increment. */
function WalletPage() {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  return (
    <Shell>
      {signedIn ? (
        <>
          <SectionTitle>{t("wallet.title")}</SectionTitle>
          <p className="-mt-3 text-[14px] text-cc-lavender">{t("wallet.subtitle")}</p>
          <Notice tone="info">{t("shell.comingSoon")}</Notice>
        </>
      ) : (
        <SignInGate title={t("wallet.gateTitle")} returnTo="/wallet" />
      )}
    </Shell>
  );
}
