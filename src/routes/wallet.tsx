import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { SectionTitle } from "@/components/ui/section-title";
import { SignInGate } from "@/features/auth/sign-in-gate";
import { useSession } from "@/features/auth/session";
import { BalanceCard } from "@/features/wallet/balance-card";
import { DepositDialog } from "@/features/cashier/deposit-dialog";
import { WithdrawDialog } from "@/features/cashier/withdraw-dialog";
import { Transactions } from "@/features/cashier/transactions";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

type Action = "deposit" | "withdraw";
const asAction = (hash: string): Action | null => (hash === "deposit" || hash === "withdraw" ? hash : null);

/**
 * Design (Wallet): a guest sees the sign-in gate and no personal data; a player sees the live balance card, the
 * cashier (P3-28 — Deposit and Withdraw open their dialogs) and Recent transactions. The header's Deposit lands on
 * `#deposit` (and `#withdraw` likewise): the dialog it names is open while the hash names it; closing drops the hash.
 */
function WalletPage() {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  // The dialog open is the URL's hash — the router's, not window's: the header's Deposit link changes it with
  // pushState, which fires no hashchange. The buttons set it too, so Back closes a dialog like any other page.
  const hash = useRouterState({ select: (st) => st.location.hash });
  const navigate = useNavigate();
  const action = asAction(hash);
  // Opened from the page's own buttons = one pushed entry, so closing goes Back to it (no duplicate /wallet entry);
  // arrived with the hash (a link, a reload) = nothing of ours to go back to, so closing replaces.
  const pushed = useRef(false);
  const open = (next: Action) => {
    pushed.current = true;
    void navigate({ to: "/wallet", hash: next });
  };
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      void navigate({ to: "/wallet", hash: "", replace: true });
    }
  };

  return (
    <Shell>
      {signedIn ? (
        <>
          <SectionTitle>{t("wallet.title")}</SectionTitle>
          <p className="-mt-3 text-[14px] text-cc-lavender">{t("wallet.subtitle")}</p>
          <BalanceCard onDeposit={() => open("deposit")} onWithdraw={() => open("withdraw")} onRetry={() => window.location.reload()} />
          <Transactions />
          {/* keyed on open: every opening starts from a clean form */}
          <DepositDialog key={`deposit-${action === "deposit"}`} open={action === "deposit"} onOpenChange={(o) => (o ? open("deposit") : close())} />
          <WithdrawDialog key={`withdraw-${action === "withdraw"}`} open={action === "withdraw"} onOpenChange={(o) => (o ? open("withdraw") : close())} />
        </>
      ) : (
        <SignInGate title={t("wallet.gateTitle")} returnTo={hash ? `/wallet#${hash}` : "/wallet"} />
      )}
    </Shell>
  );
}
