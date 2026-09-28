import { createRootRouteWithContext, Outlet, useNavigate } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider, sessionQueryOptions, useSessionState } from "@/features/auth/session";
import { AuthDialog } from "@/features/auth/auth-dialog";
import { AgeConsentPrompt } from "@/features/account/age-consent-prompt";
import { BalanceConnection } from "@/features/wallet/balance-connection";
import { BonusDrawer } from "@/features/bonus/bonus-drawer";
import { captureAttribution } from "@/features/auth/attribution";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { queryKeys } from "@/lib/queryKeys";

export interface RouterContext {
  queryClient: QueryClient;
}

const Devtools = import.meta.env.DEV
  ? lazy(async () => {
      const [{ TanStackRouterDevtools }, { ReactQueryDevtools }] = await Promise.all([
        import("@tanstack/react-router-devtools"),
        import("@tanstack/react-query-devtools"),
      ]);
      return { default: () => (<><TanStackRouterDevtools position="bottom-left" /><ReactQueryDevtools buttonPosition="bottom-left" /></>) };
    })
  : () => null;

export const Route = createRootRouteWithContext<RouterContext>()({
  // The session is resolved ONCE before the first render, so the shell never flashes the guest state at a player.
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionQueryOptions()),
  component: RootLayout,
});

function RootLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSessionState();
  const state = session.data ?? { signedIn: false as const };

  useEffect(() => {
    captureAttribution();
  }, []);

  // A dead session anywhere in the client: the cookies are already gone; say so once and offer sign-in over the page.
  const onLost = useCallback(() => {
    toast.error(t("auth.sessionExpired"));
    void session.refetch();
    authDialog.open("signin", window.location.pathname + window.location.search);
    void navigate({ to: "/" });
  }, [t, session, navigate]);

  return (
    <SessionProvider state={state} onLost={onLost}>
      <Outlet />
      <AuthDialog />
      {state.signedIn ? <AgeConsentPrompt /> : null}
      {/* one hub connection per signed-in session; unmounting on sign-out closes it and forgets the balance */}
      {state.signedIn ? <BalanceConnection /> : null}
      {state.signedIn ? <BonusDrawer /> : null}
      <Toaster />
      <Suspense fallback={null}>
        <Devtools />
      </Suspense>
    </SessionProvider>
  );
}

export { queryKeys };
