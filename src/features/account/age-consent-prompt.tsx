import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useAccount, useConfirmAge } from "./api";
import { useLogout } from "@/features/auth/session";

/**
 * P3-24 — the legal-age consent for a player who arrived by Telegram or Google, where no register checkbox was in the
 * way (owner 2026-09-27: a consent, never a date of birth). Asked once, over any page, while the account has none on
 * record; "Sign out" is the only other way out.
 */
export function AgeConsentPrompt() {
  const { t } = useTranslation();
  const account = useAccount();
  const confirm = useConfirmAge();
  const signOut = useLogout();
  const open = account.data !== undefined && !account.data.ageConfirmed;
  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[210] flex items-center justify-center bg-cc-scrim p-5 animate-cc-fade">
          <DialogPrimitive.Content onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} aria-describedby="age-consent-body"
            className="flex w-full max-w-[440px] flex-col gap-4 rounded-cc-2xl border border-cc-line-strong bg-[image:var(--cc-dialog)] p-6 shadow-[0_30px_80px_rgba(4,1,9,.7)] outline-none">
            <DialogPrimitive.Title className="m-0 text-[22px] font-extrabold text-cc-ink">{t("account.age.title")}</DialogPrimitive.Title>
            <p id="age-consent-body" className="m-0 text-[13.5px] leading-[1.55] text-cc-lavender">
              <Trans i18nKey="auth.consent" components={{ terms: <a href="/info/terms" target="_blank" rel="noopener" className="font-bold" />, privacy: <a href="/info/privacy" target="_blank" rel="noopener" className="font-bold" /> }} />
            </p>
            {confirm.isError ? <Notice tone="error">{t("auth.error.UNKNOWN")}</Notice> : null}
            <Button variant="primary" size="lg" loading={confirm.isPending} onClick={() => confirm.mutate()}>{t("account.age.confirm")}</Button>
            <Button variant="ghost" onClick={() => signOut.mutate()}>{t("account.age.signOut")}</Button>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
