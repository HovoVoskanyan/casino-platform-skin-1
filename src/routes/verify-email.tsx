import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { SectionTitle } from "@/components/ui/section-title";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { useResendVerification, useVerifyEmail } from "@/features/auth/session";

const search = z.object({ email: z.string().optional(), token: z.string().optional() });

export const Route = createFileRoute("/verify-email")({ validateSearch: search, component: VerifyEmailPage });

/** Identity's confirmation mail links here as `/verify-email?email=&token=` (parity link shape); the page posts the pair once. */
function VerifyEmailPage() {
  const { t } = useTranslation();
  const { email, token } = Route.useSearch();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const missing = !email || !token;

  // Post the pair exactly once per landing; the mutation's own state is the page's state.
  useEffect(() => {
    if (!missing) verify.mutate({ email, token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, token]);

  const status = missing || verify.isError ? "failed" : verify.isSuccess ? "done" : "working";
  const code = missing ? "INVALID_EMAIL_OR_TOKEN" : (verify.error?.errorCode ?? "UNKNOWN");

  return (
    <Shell>
      <SectionTitle>{t("verify.title")}</SectionTitle>
      {status === "working" ? <Notice tone="info">{t("verify.working")}</Notice> : null}
      {status === "done" ? <Notice tone="ok">{t("verify.done")}</Notice> : null}
      {status === "failed" ? (
        <>
          <Notice tone="error">{t("verify.failed")} {t(`auth.error.${code}`, { defaultValue: "" })}</Notice>
          {email ? <Button variant="secondary" className="self-start" loading={resend.isPending} onClick={() => resend.mutate({ email }, { onSettled: () => toast.success(t("verify.resent")) })}>{t("verify.resend")}</Button> : null}
        </>
      ) : null}
      <Button asChild variant="primary" className="self-start"><a href="/">{t("verify.goHome")}</a></Button>
    </Shell>
  );
}
