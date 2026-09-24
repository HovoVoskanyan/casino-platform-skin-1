import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useChangePassword, useTotpConfirm, useTotpDisable, useTotpEnroll, type TotpEnrollment } from "@/features/auth/session";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "auth.validation.passwordRequired"),
    newPassword: z.string().min(8, "auth.validation.passwordLength").refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "auth.validation.passwordMix"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "account.security.confirmMismatch" });

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "auth.validation.totp") });

/** Design (My Account → Security): change password; plus two-factor, which identity has and the design's method list is the home for. */
export function SecurityTab() {
  const { t } = useTranslation();
  const errorText = (code: string) => t(`auth.error.${code}`, { defaultValue: t("auth.error.UNKNOWN") });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PasswordCard errorText={errorText} />
      <TotpCard errorText={errorText} />
    </div>
  );
}

function Card({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-cc-xl border border-cc-line bg-cc-surface p-5">
      <div>
        <h2 className="m-0 text-[18px] font-extrabold tracking-[-0.3px]">{title}</h2>
        <p className="m-0 mt-1 text-[13px] leading-[1.5] text-cc-lavender">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function PasswordCard({ errorText }: { errorText: (c: string) => string }) {
  const { t } = useTranslation();
  const change = useChangePassword();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const fe = (m?: string) => (m ? t(m) : undefined);

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      toast.success(t("account.security.passwordUpdated"));
      form.reset();
      setOpen(false);
    } catch (e) {
      setError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
    }
  });

  return (
    <Card title={t("account.security.password")} intro={t("account.security.passwordIntro")}>
      {open ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label={t("account.security.currentPassword")} htmlFor="pw-current" error={fe(form.formState.errors.currentPassword?.message)}>
            <Input id="pw-current" type="password" autoComplete="current-password" aria-invalid={!!form.formState.errors.currentPassword} {...form.register("currentPassword")} />
          </Field>
          <Field label={t("account.security.newPassword")} htmlFor="pw-new" error={fe(form.formState.errors.newPassword?.message)} hint={t("auth.passwordHint")}>
            <Input id="pw-new" type="password" autoComplete="new-password" aria-invalid={!!form.formState.errors.newPassword} {...form.register("newPassword")} />
          </Field>
          <Field label={t("account.security.confirmPassword")} htmlFor="pw-confirm" error={fe(form.formState.errors.confirm?.message)}>
            <Input id="pw-confirm" type="password" autoComplete="new-password" aria-invalid={!!form.formState.errors.confirm} {...form.register("confirm")} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={change.isPending}>{t("account.security.updatePassword")}</Button>
            <Button variant="secondary" onClick={() => { setOpen(false); form.reset(); setError(null); }}>{t("cancel")}</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>{t("account.security.changePassword")}</Button>
      )}
    </Card>
  );
}

function TotpCard({ errorText }: { errorText: (c: string) => string }) {
  const { t } = useTranslation();
  const enroll = useTotpEnroll();
  const confirm = useTotpConfirm();
  const disable = useTotpDisable();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null); // identity has no "me" yet (P3-24); the state is what this tab last did
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });
  const fe = (m?: string) => (m ? t(m) : undefined);

  const start = () => {
    setError(null);
    enroll.mutate(undefined, {
      onSuccess: (e) => setEnrollment(e),
      onError: (e) => {
        if (e.errorCode === "TOTP_ALREADY_ENABLED") setEnabled(true);
        else setError(errorText(e.errorCode));
      },
    });
  };

  const submitConfirm = form.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      await confirm.mutateAsync({ code });
      toast.success(t("account.security.totpEnabled"));
      setEnrollment(null);
      setEnabled(true);
      form.reset();
    } catch (e) {
      setError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
    }
  });

  const submitDisable = form.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      await disable.mutateAsync({ code });
      toast.success(t("account.security.totpDisabled"));
      setDisabling(false);
      setEnabled(false);
      form.reset();
    } catch (e) {
      setError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
    }
  });

  return (
    <Card title={t("account.security.totp")} intro={t("account.security.totpIntro")}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {enrollment ? (
        <form onSubmit={submitConfirm} noValidate className="flex flex-col gap-4">
          <Notice tone="info">{t("account.security.totpScan")}</Notice>
          <a href={enrollment.otpAuthUri} className="break-all text-[12px] font-semibold">{enrollment.otpAuthUri}</a>
          <details className="text-[12px] text-cc-muted"><summary className="cursor-pointer">{t("account.security.totpSecret")}</summary><code className="mt-1 block break-all font-mono text-cc-lavender">{enrollment.secret}</code></details>
          <Field label={t("account.security.totpCodeLabel")} htmlFor="totp-code" error={fe(form.formState.errors.code?.message)}>
            <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="tracking-[6px]" aria-invalid={!!form.formState.errors.code} {...form.register("code")} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={confirm.isPending}>{t("account.security.totpConfirm")}</Button>
            <Button variant="secondary" onClick={() => { setEnrollment(null); form.reset(); }}>{t("cancel")}</Button>
          </div>
        </form>
      ) : disabling ? (
        <form onSubmit={submitDisable} noValidate className="flex flex-col gap-4">
          <Field label={t("account.security.totpCodeLabel")} htmlFor="totp-off" error={fe(form.formState.errors.code?.message)}>
            <Input id="totp-off" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="tracking-[6px]" aria-invalid={!!form.formState.errors.code} {...form.register("code")} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={disable.isPending}>{t("account.security.totpDisable")}</Button>
            <Button variant="secondary" onClick={() => { setDisabling(false); form.reset(); }}>{t("cancel")}</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {enabled ? <Notice tone="ok" className="w-full">{t("account.security.totpEnabled")}</Notice> : null}
          <Button variant="secondary" onClick={start} loading={enroll.isPending}>{t("account.security.totpEnable")}</Button>
          <Button variant="ghost" onClick={() => setDisabling(true)}>{t("account.security.totpDisable")}</Button>
        </div>
      )}
    </Card>
  );
}
