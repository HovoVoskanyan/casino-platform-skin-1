import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { AccountCard } from "./account-card";
import { useSetPassword, useUnlinkTelegram, type Account } from "./api";

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, "auth.validation.passwordLength").refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "auth.validation.passwordMix"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "account.security.confirmMismatch" });

/**
 * Design (My Account → Security, "Connected login methods"): the password (set one if the account never had it) and
 * Telegram (connected → Disconnect). Telegram cannot go while it is the only way in — the design's own copy says so,
 * and identity refuses it (LAST_SIGN_IN_METHOD) whatever the screen shows.
 */
export function SignInMethodsCard({ account, errorText }: { account: Account; errorText: (code: string) => string }) {
  const { t } = useTranslation();
  const unlink = useUnlinkTelegram();
  const [error, setError] = useState<string | null>(null);
  const telegram = account.linkedProviders.includes("telegram");
  const google = account.linkedProviders.includes("google");
  // Mirrors identity (P3-24 review S2): a password is a way in only with an email or number to sign in and reset with —
  // a Telegram username is copied and not unique.
  const identifier = account.email ?? account.phone;
  const telegramIsOnlyWay = telegram && !google && !(account.hasPassword && identifier);

  return (
    <AccountCard title={t("account.methods.title")} intro={t("account.methods.intro")}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <MethodRow name={t("account.methods.password")} state={account.hasPassword ? (identifier ? t("account.methods.signInWith", { value: identifier }) : t("account.methods.set")) : t("account.methods.notSet")} />
      {!account.hasPassword ? <SetPasswordForm errorText={errorText} /> : null}
      {telegram ? (
        <div className="flex flex-col gap-3">
          <MethodRow name="Telegram" state={t("account.methods.connected")}
            action={<Button size="sm" variant="ghost" disabled={telegramIsOnlyWay} loading={unlink.isPending}
              onClick={() => unlink.mutate(undefined, { onSuccess: () => toast.success(t("account.methods.telegramDisconnected")), onError: (e) => setError(errorText(e.errorCode)) })}>
              {t("account.methods.disconnect")}
            </Button>} />
          {telegramIsOnlyWay ? <Notice tone="info">{t("account.methods.onlyWay")}</Notice> : null}
        </div>
      ) : null}
      {google ? <MethodRow name="Google" state={t("account.methods.connected")} /> : null}
    </AccountCard>
  );
}

function MethodRow({ name, state, action }: { name: string; state: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-cc-lg border border-cc-line bg-white/[.02] px-4 py-3">
      <span className="flex flex-col gap-[2px]">
        <span className="text-[14.5px] font-bold text-cc-ink">{name}</span>
        <span className="text-[12.5px] text-cc-lavender">{state}</span>
      </span>
      {action}
    </div>
  );
}

function SetPasswordForm({ errorText }: { errorText: (code: string) => string }) {
  const { t } = useTranslation();
  const set = useSetPassword();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { newPassword: "", confirm: "" } });
  const fe = (m?: string) => (m ? t(m) : undefined);
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await set.mutateAsync({ newPassword: v.newPassword });
      toast.success(t("account.methods.passwordSet"));
      form.reset();
    } catch (e) {
      setError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label={t("account.security.newPassword")} htmlFor="sp-new" hint={t("auth.passwordHint")} error={fe(form.formState.errors.newPassword?.message)}>
        <Input id="sp-new" type="password" autoComplete="new-password" aria-invalid={!!form.formState.errors.newPassword} {...form.register("newPassword")} />
      </Field>
      <Field label={t("account.security.confirmPassword")} htmlFor="sp-confirm" error={fe(form.formState.errors.confirm?.message)}>
        <Input id="sp-confirm" type="password" autoComplete="new-password" aria-invalid={!!form.formState.errors.confirm} {...form.register("confirm")} />
      </Field>
      <Button type="submit" variant="primary" className="self-start" loading={set.isPending}>{t("account.methods.setPassword")}</Button>
    </form>
  );
}
