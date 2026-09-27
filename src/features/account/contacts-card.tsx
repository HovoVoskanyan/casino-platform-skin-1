import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { toLogin } from "@/features/auth/phone";
import { AccountCard } from "./account-card";
import { useCancelContactChange, useConfirmPhoneChange, useResendContactChange, useStartContactChange, useVerifyCurrentContact, type Account, type Contact } from "./api";

const emailSchema = z.object({ value: z.string().trim().min(1, "auth.validation.emailRequired").email("auth.validation.email"), password: z.string() });
const phoneSchema = z.object({ value: z.string().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^9\d{9}$/, "auth.validation.phone")), password: z.string() });
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "auth.validation.otp") });

/**
 * Design (My Account → Security, contact details): the email and the mobile number — "Not added" when absent, a
 * pending change shown as CHANGE PENDING until the NEW contact confirms it (a link to the new email, a code to the
 * new number); the current one stays the sign-in detail until then. "Resend confirmation", "Cancel change". A current
 * detail that was never confirmed (the sign-up's code step skipped) gets "Verify" (P3-24 review S1).
 */
export function ContactsCard({ account, errorText }: { account: Account; errorText: (code: string) => string }) {
  const { t } = useTranslation();
  return (
    <AccountCard title={t("account.contacts.title")} intro={t("account.contacts.intro")}>
      <ContactRow contact="email" account={account} errorText={errorText} />
      <ContactRow contact="phone" account={account} errorText={errorText} />
    </AccountCard>
  );
}

function ContactRow({ contact, account, errorText }: { contact: Contact; account: Account; errorText: (code: string) => string }) {
  const { t } = useTranslation();
  const current = contact === "email" ? account.email : account.phone;
  const verified = contact === "email" ? account.emailVerified : account.phoneVerified;
  const pending = contact === "email" ? account.pendingEmail : account.pendingPhone;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resend = useResendContactChange();
  const cancel = useCancelContactChange();
  const verify = useVerifyCurrentContact();
  const [verifying, setVerifying] = useState(false);
  const startVerify = () => {
    setError(null);
    const onError = (e: { errorCode?: string }) => setError(errorText(e.errorCode ?? "UNKNOWN"));
    if (contact === "email") verify.resendEmail.mutate({ email: current! }, { onSuccess: () => setVerifying(true), onError });
    else verify.resendPhone.mutate({ phone: current! }, { onSuccess: () => setVerifying(true), onError });
  };
  const label = t(contact === "email" ? "account.contacts.email" : "account.contacts.phone");

  return (
    <div className="flex flex-col gap-3 rounded-cc-lg border border-cc-line bg-white/[.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="text-[11.5px] font-bold tracking-[.8px] text-cc-muted uppercase">{label}</span>
          <span className="truncate text-[15px] font-bold text-cc-ink">{current ?? <span className="text-cc-muted">{t("account.contacts.notAdded")}</span>}</span>
        </div>
        <span className="flex items-center gap-2">
          {current ? <span className={verified ? "text-[12px] font-bold text-cc-ok" : "text-[12px] font-bold text-cc-gold"}>{t(verified ? "account.contacts.verified" : "account.contacts.unverified")}</span> : null}
          {current && !verified && !pending && !editing && !verifying ? (
            <Button size="sm" variant="primary" loading={verify.resendEmail.isPending || verify.resendPhone.isPending} onClick={startVerify}>{t("account.contacts.verify")}</Button>
          ) : null}
          {!editing && !pending ? <Button size="sm" variant="secondary" onClick={() => { setEditing(true); setError(null); }}>{t(current ? "account.contacts.change" : "account.contacts.add")}</Button> : null}
        </span>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {verifying && current && !verified ? (
        <div className="flex flex-col gap-3 rounded-cc border border-cc-line-strong bg-white/[.03] p-3">
          <span className="text-[13.5px] text-cc-text">{t(contact === "email" ? "account.contacts.verifyEmailSent" : "account.contacts.verifyPhoneSent", { value: current })}</span>
          {contact === "phone" ? <CurrentPhoneCodeForm phone={current} errorText={errorText} onError={setError} onDone={() => setVerifying(false)} /> : null}
        </div>
      ) : null}

      {pending ? (
        <div className="flex flex-col gap-3 rounded-cc border border-[rgba(255,201,60,.35)] bg-[rgba(255,201,60,.06)] p-3">
          <span className="text-[11px] font-extrabold tracking-[1px] text-cc-gold">{t("account.contacts.pending")}</span>
          <span className="text-[13.5px] text-cc-text">{t(contact === "email" ? "account.contacts.pendingEmail" : "account.contacts.pendingPhone", { value: pending })}</span>
          {contact === "phone" ? <PhoneCodeForm errorText={errorText} onError={setError} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate(contact, { onSuccess: () => toast.success(t("account.contacts.resent")), onError: (e) => setError(errorText(e.errorCode)) })}>{t("account.contacts.resend")}</Button>
            <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(contact, { onSuccess: () => toast.success(t("account.contacts.cancelled")), onError: (e) => setError(errorText(e.errorCode)) })}>{t("account.contacts.cancel")}</Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <ChangeForm contact={contact} askPassword={account.hasPassword} errorText={errorText}
          onDone={() => { setEditing(false); setError(null); }} onCancel={() => { setEditing(false); setError(null); }} />
      ) : null}
    </div>
  );
}

function ChangeForm({ contact, askPassword, errorText, onDone, onCancel }: { contact: Contact; askPassword: boolean; errorText: (code: string) => string; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const start = useStartContactChange();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ value: string; password: string }>({ resolver: zodResolver(contact === "email" ? emailSchema : phoneSchema), defaultValues: { value: "", password: "" } });
  const fe = (m?: string) => (m ? t(m) : undefined);

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    if (askPassword && !v.password) {
      form.setError("password", { message: "auth.validation.passwordRequired" });
      return;
    }

    try {
      await start.mutateAsync({ contact, value: contact === "email" ? v.value.trim() : toLogin("phone", v.value), password: askPassword ? v.password : null });
      toast.success(t(contact === "email" ? "account.contacts.linkSent" : "account.contacts.codeSent"));
      onDone();
    } catch (e) {
      setError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {contact === "email" ? (
        <Field label={t("account.contacts.newEmail")} htmlFor="cc-email" error={fe(form.formState.errors.value?.message)}>
          <Input id="cc-email" type="email" autoComplete="email" autoCapitalize="none" aria-invalid={!!form.formState.errors.value} {...form.register("value")} />
        </Field>
      ) : (
        <Field label={t("account.contacts.newPhone")} htmlFor="cc-phone" hint={t("auth.phoneHint")} error={fe(form.formState.errors.value?.message)}>
          <div className="relative flex">
            <span aria-hidden className="absolute left-0 top-0 flex h-full items-center border-r border-cc-line-strong px-[14px] text-[15px] font-bold text-cc-text">+63</span>
            <Input id="cc-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="9XXXXXXXXX" maxLength={12} className="pl-[68px]" aria-invalid={!!form.formState.errors.value} {...form.register("value")} />
          </div>
        </Field>
      )}
      {askPassword ? (
        <Field label={t("account.security.currentPassword")} htmlFor={`cc-pw-${contact}`} hint={t("account.contacts.passwordWhy")} error={fe(form.formState.errors.password?.message)}>
          <Input id={`cc-pw-${contact}`} type="password" autoComplete="current-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
        </Field>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={start.isPending}>{t(contact === "email" ? "account.contacts.sendLink" : "account.contacts.sendCode")}</Button>
        <Button variant="secondary" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </form>
  );
}

function PhoneCodeForm({ errorText, onError }: { errorText: (code: string) => string; onError: (message: string | null) => void }) {
  const { t } = useTranslation();
  const confirm = useConfirmPhoneChange();
  const form = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });
  const submit = form.handleSubmit(async ({ code }) => {
    onError(null);
    try {
      await confirm.mutateAsync({ code });
      toast.success(t("account.contacts.phoneChanged"));
    } catch (e) {
      onError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
      <Field label={t("auth.verifyPhoneCodeLabel")} htmlFor="cc-code" error={form.formState.errors.code?.message ? t(form.formState.errors.code.message) : undefined} className="min-w-[180px] flex-1">
        <Input id="cc-code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} className="tracking-[6px]" {...form.register("code")} />
      </Field>
      <Button type="submit" variant="primary" loading={confirm.isPending}>{t("account.contacts.confirmCode")}</Button>
    </form>
  );
}

/** The code the sign-up endpoint texted to the CURRENT number — verify-phone, as the sign-up's own code step does. */
function CurrentPhoneCodeForm({ phone, errorText, onError, onDone }: { phone: string; errorText: (code: string) => string; onError: (message: string | null) => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { verifyPhone, refresh } = useVerifyCurrentContact();
  const form = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });
  const submit = form.handleSubmit(async ({ code }) => {
    onError(null);
    try {
      await verifyPhone.mutateAsync({ phone, code });
      toast.success(t("account.contacts.phoneVerified"));
      refresh();
      onDone();
    } catch (e) {
      onError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
      <Field label={t("auth.verifyPhoneCodeLabel")} htmlFor="cc-current-code" error={form.formState.errors.code?.message ? t(form.formState.errors.code.message) : undefined} className="min-w-[180px] flex-1">
        <Input id="cc-current-code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} className="tracking-[6px]" {...form.register("code")} />
      </Field>
      <Button type="submit" variant="primary" loading={verifyPhone.isPending}>{t("account.contacts.confirmCode")}</Button>
    </form>
  );
}
