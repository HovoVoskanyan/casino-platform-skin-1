import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Shell } from "@/components/layout/shell";
import { Notice } from "@/components/ui/notice";
import { queryKeys } from "@/lib/queryKeys";

const search = z.object({ returnTo: z.string().optional() });

export const Route = createFileRoute("/auth/callback")({ validateSearch: search, component: GoogleCallbackPage });

/**
 * Where the gateway lands the browser after Google (P3-04 cookie mode): `#login=ok&expires_at=…&SessionId=…`. The
 * cookies are already set; the page only reads the fragment, clears it and continues to the remembered destination.
 * No token is ever in the fragment.
 */
function GoogleCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { returnTo } = Route.useSearch();

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const ok = fragment.get("login") === "ok";
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
    if (ok) {
      void qc.invalidateQueries({ queryKey: queryKeys.session.all }).then(() => {
        toast.success(t("auth.signedIn"));
        void navigate({ to: returnTo && returnTo.startsWith("/") ? returnTo : "/" });
      });
    } else {
      toast.error(t("auth.error.UNKNOWN"));
      void navigate({ to: "/" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell>
      <Notice tone="info">{t("loading")}</Notice>
    </Shell>
  );
}
