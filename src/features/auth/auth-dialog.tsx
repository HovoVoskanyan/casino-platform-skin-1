import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import { authDialog, useAuthDialog, type AuthMode } from "./auth-dialog-state";
import { readAttribution } from "./attribution";
import { TelegramButton } from "./telegram-button";
import { toLogin, type Contact } from "./phone";
import { useForgotPassword, useGoogleSignIn, useResendPhoneVerification, useResetPassword, useSignIn, useSignUp, useVerifyPhone } from "./session";

/** Design (Registration): 8+ characters with a letter and a number. */
const password = (required: string) =>
  z.string().min(1, required).min(8, "auth.validation.passwordLength").refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "auth.validation.passwordMix");
const email = z.string().trim().min(1, "auth.validation.emailRequired").email("auth.validation.email");
/** Design: the +63 prefix is fixed, the player types the ten digits of a PH mobile (9XXXXXXXXX). */
const phone = z.string().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().min(1, "auth.validation.phoneRequired").regex(/^9\d{9}$/, "auth.validation.phone"));
const login = (contact: Contact) => (contact === "phone" ? phone : email);

const signInSchema = (c: Contact) => z.object({ login: login(c), password: z.string().min(1, "auth.validation.passwordRequired") });
const registerSchema = (c: Contact) => z.object({ login: login(c), password: password("auth.validation.passwordCreate"), consent: z.literal(true, { message: "auth.consentRequired" }) });
const resetSchema = (c: Contact) => z.object({ login: login(c) });
const resetConfirmSchema = (c: Contact) => z.object({ login: login(c), otp: z.string().trim().regex(/^\d{6}$/, "auth.validation.otp"), newPassword: password("auth.validation.passwordCreate") });
const totpSchema = z.object({ totpCode: z.string().trim().regex(/^\d{6}$/, "auth.validation.totp") });
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "auth.validation.otp") });

type SignInValues = z.infer<ReturnType<typeof signInSchema>>;
type RegisterValues = z.infer<ReturnType<typeof registerSchema>>;
type ResetValues = z.infer<ReturnType<typeof resetSchema>>;
type ResetConfirmValues = z.infer<ReturnType<typeof resetConfirmSchema>>;

type View = AuthMode | "reset-confirm" | "totp" | "verify-phone";

/**
 * The ONE auth dialog (design: Registration). Opens over whichever page asked, in the mode the hash names, and
 * returns the player to the destination the opener remembered. Views: signin → (totp) · register · reset →
 * reset-confirm, and after a sign-up by phone, verify-phone (the SMS code — skippable: confirming is not a gate). Phone
 * is the design's default tab (P3-24): +63 and the ten digits, sent to identity in E.164. Cookies are set by the
 * gateway; the page never sees a token.
 */
export function AuthDialog() {
  const { mode } = useAuthDialog();
  return (
    <DialogPrimitive.Root open={mode !== null} onOpenChange={(open) => { if (!open) authDialog.close(); }}>
      {mode ? <AuthDialogContent key={mode} initialMode={mode} /> : null}
    </DialogPrimitive.Root>
  );
}

function AuthDialogContent({ initialMode }: { initialMode: AuthMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<View>(initialMode);
  const [contact, setContact] = useState<Contact>("phone");
  const [formError, setFormError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [pending, setPending] = useState<{ email: string; password: string } | null>(null);
  const [resetLogin, setResetLogin] = useState("");
  const [verifyingPhone, setVerifyingPhone] = useState("");

  const signIn = useSignIn();
  const signUp = useSignUp();
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const google = useGoogleSignIn();
  const verifyPhone = useVerifyPhone();
  const resendPhone = useResendPhoneVerification();
  const byContact = (value: string) => (contact === "phone" ? { phone: toLogin("phone", value) } : { email: value.trim() });

  const errorText = (code: string) => t(`auth.error.${code}`, { defaultValue: t("auth.error.UNKNOWN") });
  const fieldError = (msg?: string) => (msg ? t(msg) : undefined);

  const finish = async (message: string) => {
    const target = authDialog.consumeReturnTo();
    authDialog.close(true);
    toast.success(message);
    if (target) await navigate({ to: target });
  };

  const switchView = (next: View) => {
    setFormError(null);
    setShown(false);
    setView(next);
    if (next === "signin" || next === "register" || next === "reset") authDialog.switchTo(next);
  };

  const heading = useMemo(() => {
    switch (view) {
      case "signin": return [t("auth.signInTitle"), t("auth.signInSubhead")];
      case "register": return [t("auth.registerTitle"), t("auth.registerSubhead")];
      case "reset": return [t("auth.resetTitle"), t("auth.resetSubhead")];
      case "reset-confirm": return [t("auth.resetCodeTitle"), t("auth.resetCodeSubhead")];
      case "totp": return [t("auth.totpTitle"), t("auth.totpSubhead")];
      case "verify-phone": return [t("auth.verifyPhoneTitle"), t("auth.verifyPhoneSubhead", { phone: verifyingPhone })];
    }
  }, [view, t, verifyingPhone]);

  const closeLabel = view === "register" ? t("auth.closeRegister") : view === "reset" || view === "reset-confirm" ? t("auth.closeReset") : t("auth.closeSignIn");

  const startGoogle = () => {
    setFormError(null);
    google.mutate({ returnTo: authDialog.get().returnTo }, {
      onSuccess: (url) => window.location.assign(url),
      onError: (e) => setFormError(errorText(e.errorCode)),
    });
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[200] flex items-stretch justify-center overflow-auto bg-cc-canvas-base p-0 animate-cc-fade sm:items-center sm:bg-cc-scrim sm:p-6">
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="relative flex w-full max-w-full flex-col gap-[18px] bg-[image:var(--cc-dialog)] px-5 pb-[calc(40px+env(safe-area-inset-bottom))] shadow-[0_30px_80px_rgba(4,1,9,.7)] outline-none animate-cc-rise sm:w-[476px] sm:max-h-[calc(100vh-48px)] sm:overflow-auto sm:rounded-cc-2xl sm:border sm:border-cc-line-strong sm:px-7 sm:pb-6"
        >
          <div className="sticky top-0 z-[2] -mx-5 flex items-start justify-between gap-3 border-b border-[rgba(167,139,250,.14)] bg-[#2a1049] px-5 pb-[14px] pt-[18px] sm:-mx-7 sm:px-7 sm:pt-[22px]">
            <img src="/chocho-logo-cut.png" alt="ChoCho" className="block h-11 w-[62px] flex-none object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,.5)]" />
            <DialogPrimitive.Close aria-label={closeLabel} className="flex h-10 w-10 flex-none items-center justify-center rounded-cc-md border border-cc-line-strong bg-white/[.06] text-[15px] font-extrabold text-[#cbb6e6] hover:bg-white/[.14] hover:text-cc-ink">✕</DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-[6px]">
            <DialogPrimitive.Title className="m-0 text-[25px] font-extrabold leading-[1.2] tracking-[-0.6px] text-cc-ink">{heading[0]}</DialogPrimitive.Title>
            <p className="m-0 text-[13.5px] font-medium leading-[1.5] text-cc-lavender text-pretty">{heading[1]}</p>
          </div>

          {(view === "signin" || view === "register" || view === "reset") ? (
            <div role="tablist" aria-label="Contact method" className="grid grid-cols-2 gap-[6px] rounded-cc-lg border border-cc-line bg-white/[.03] p-[5px]">
              {(["phone", "email"] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  type="button"
                  aria-selected={contact === tab}
                  onClick={() => { setContact(tab); setFormError(null); }}
                  className={cn("flex h-[46px] items-center justify-center rounded-cc text-[14px] font-extrabold transition-colors", contact === tab ? "bg-[image:var(--cc-gold-cta)] text-[#2c1400] shadow-[0_6px_18px_rgba(235,156,13,.3)]" : "text-[#bfaed8]")}
                >
                  {t(tab === "phone" ? "auth.tabPhone" : "auth.tabEmail")}
                </button>
              ))}
            </div>
          ) : null}

          {formError ? <Notice tone="error">{formError}</Notice> : null}

          {view === "signin" ? (
            <SignInForm
              key={contact}
              contact={contact}
              onForgot={() => switchView("reset")}
              onSubmit={async (values) => {
                setFormError(null);
                const identifier = toLogin(contact, values.login);
                try {
                  await signIn.mutateAsync({ emailOrUsername: identifier, password: values.password });
                  await finish(t("auth.signedIn"));
                } catch (e) {
                  const code = (e as { errorCode?: string }).errorCode ?? "UNKNOWN";
                  if (code === "TOTP_REQUIRED") { setPending({ email: identifier, password: values.password }); switchView("totp"); }
                  else setFormError(errorText(code));
                }
              }}
              pending={signIn.isPending}
              shown={shown}
              onToggle={() => setShown((s) => !s)}
              fieldError={fieldError}
            />
          ) : null}

          {view === "totp" && pending ? (
            <TotpForm
              pending={signIn.isPending}
              fieldError={fieldError}
              onSubmit={async ({ totpCode }) => {
                setFormError(null);
                try {
                  await signIn.mutateAsync({ emailOrUsername: pending.email, password: pending.password, totpCode });
                  await finish(t("auth.signedIn"));
                } catch (e) {
                  setFormError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
                }
              }}
            />
          ) : null}

          {view === "register" ? (
            <RegisterForm
              key={contact}
              contact={contact}
              pending={signUp.isPending}
              shown={shown}
              onToggle={() => setShown((s) => !s)}
              fieldError={fieldError}
              onSubmit={async (values) => {
                setFormError(null);
                const attribution = readAttribution();
                try {
                  await signUp.mutateAsync({ ...byContact(values.login), password: values.password, ageConfirmed: values.consent, affiliate: attribution.affiliate, source: attribution.source });
                  if (contact === "phone") {
                    // Signed in already; the code confirms the number (not a gate — "Later" finishes).
                    setVerifyingPhone(toLogin("phone", values.login));
                    switchView("verify-phone");
                  } else {
                    await finish(t("auth.registered"));
                  }
                } catch (e) {
                  setFormError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
                }
              }}
            />
          ) : null}

          {view === "reset" ? (
            <ResetForm
              key={contact}
              contact={contact}
              pending={forgot.isPending}
              fieldError={fieldError}
              onSubmit={async ({ login: value }) => {
                setFormError(null);
                try {
                  await forgot.mutateAsync(byContact(value));
                  setResetLogin(value);
                  toast.success(t("auth.resetSent"));
                  switchView("reset-confirm");
                } catch (e) {
                  setFormError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
                }
              }}
            />
          ) : null}

          {view === "reset-confirm" ? (
            <ResetConfirmForm
              contact={contact}
              login={resetLogin}
              pending={reset.isPending}
              shown={shown}
              onToggle={() => setShown((s) => !s)}
              fieldError={fieldError}
              onSubmit={async (values) => {
                setFormError(null);
                try {
                  await reset.mutateAsync({ ...byContact(values.login), otp: values.otp, newPassword: values.newPassword });
                  toast.success(t("auth.resetDone"));
                  switchView("signin");
                } catch (e) {
                  setFormError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
                }
              }}
            />
          ) : null}

          {view === "verify-phone" ? (
            <VerifyPhoneForm
              pending={verifyPhone.isPending}
              resending={resendPhone.isPending}
              fieldError={fieldError}
              onResend={() => resendPhone.mutate({ phone: verifyingPhone }, {
                onSuccess: () => toast.success(t("auth.verifyPhoneResent")),
                onError: (e) => setFormError(errorText(e.errorCode)),
              })}
              onLater={() => void finish(t("auth.registered"))}
              onSubmit={async ({ code }) => {
                setFormError(null);
                try {
                  await verifyPhone.mutateAsync({ phone: verifyingPhone, code });
                  await finish(t("auth.phoneVerified"));
                } catch (e) {
                  setFormError(errorText((e as { errorCode?: string }).errorCode ?? "UNKNOWN"));
                }
              }}
            />
          ) : null}

          {view === "signin" || view === "register" ? (
            <div className="flex flex-col gap-[18px]">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-[rgba(167,139,250,.18)]" />
                <span className="text-[11.5px] font-bold tracking-[1px] text-cc-muted">{t("auth.or")}</span>
                <span className="h-px flex-1 bg-[rgba(167,139,250,.18)]" />
              </div>
              <button
                type="button"
                onClick={startGoogle}
                disabled={google.isPending}
                className="flex h-[54px] w-full items-center justify-center gap-[11px] rounded-cc-lg border border-cc-line-strong bg-white/[.03] text-[14.5px] font-bold text-cc-ink hover:bg-white/[.06] disabled:opacity-70"
              >
                <GoogleIcon />
                {t("auth.google")}
              </button>
              <TelegramButton onSignedIn={() => void finish(t("auth.signedIn"))} onError={(code) => setFormError(errorText(code))} />
            </div>
          ) : null}

          {view === "verify-phone" ? null : <p className="m-0 text-center text-[13px] font-medium text-cc-lavender">
            {view === "signin" || view === "totp" ? t("auth.newHere") : view === "register" ? t("auth.haveAccount") : t("auth.remembered")}{" "}
            <button type="button" onClick={() => switchView(view === "signin" || view === "totp" ? "register" : "signin")} className="border-0 bg-transparent p-0 font-bold text-cc-gold hover:text-cc-gold-hover">
              {view === "signin" || view === "totp" ? t("auth.createAccount") : view === "register" ? t("nav.signIn") : t("auth.backToSignIn")}
            </button>
          </p>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
}

type FieldError = (msg?: string) => string | undefined;

function PasswordField({ id, label, placeholder, autoComplete, shown, onToggle, error, hint, register }: {
  id: string; label: string; placeholder: string; autoComplete: string; shown: boolean; onToggle: () => void; error?: string; hint?: string;
  register: ReturnType<ReturnType<typeof useForm>["register"]>;
}) {
  const { t } = useTranslation();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative flex">
        <Input id={id} type={shown ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} aria-invalid={!!error} className="pr-24" {...register} />
        <button type="button" onClick={onToggle} aria-pressed={shown} className="absolute right-[6px] top-[6px] h-10 min-w-[76px] rounded-cc border border-[rgba(167,139,250,.24)] bg-white/[.05] px-[14px] text-[12.5px] font-bold text-[#cbb6e6] hover:bg-[rgba(167,139,250,.16)] hover:text-cc-ink">
          {shown ? t("auth.hide") : t("auth.show")}
        </button>
      </div>
    </Field>
  );
}

/** The login field of the active tab: an email, or the design's fixed +63 prefix and the ten digits. */
function LoginField({ id, contact, error, register, autoComplete }: {
  id: string; contact: Contact; error?: string; autoComplete: string; register: ReturnType<ReturnType<typeof useForm>["register"]>;
}) {
  const { t } = useTranslation();
  if (contact === "email") {
    return (
      <Field label={t("auth.emailLabel")} htmlFor={id} error={error}>
        <Input id={id} type="email" inputMode="email" autoComplete={autoComplete === "username" ? "email" : autoComplete} autoCapitalize="none" placeholder={t("auth.emailPlaceholder")} aria-invalid={!!error} {...register} />
      </Field>
    );
  }
  return (
    <Field label={t("auth.phoneLabel")} htmlFor={id} error={error} hint={t("auth.phoneHint")}>
      <div className="relative flex">
        <span aria-hidden className="absolute left-0 top-0 flex h-full items-center border-r border-cc-line-strong px-[14px] text-[15px] font-bold text-cc-text">+63</span>
        <Input id={id} type="tel" inputMode="numeric" autoComplete={autoComplete === "username" ? "tel-national" : "tel-national"} placeholder="9XXXXXXXXX" maxLength={12} aria-invalid={!!error} className="pl-[68px] tracking-[1px]" {...register} />
      </div>
    </Field>
  );
}

function SignInForm({ contact, onSubmit, onForgot, pending, shown, onToggle, fieldError }: { contact: Contact; onSubmit: (v: SignInValues) => Promise<void>; onForgot: () => void; pending: boolean; shown: boolean; onToggle: () => void; fieldError: FieldError }) {
  const { t } = useTranslation();
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema(contact)), defaultValues: { login: "", password: "" } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
      <LoginField id="auth-login" contact={contact} autoComplete="username" error={fieldError(form.formState.errors.login?.message)} register={form.register("login")} />
      <PasswordField id="auth-password" label={t("auth.passwordLabel")} placeholder={t("auth.passwordPlaceholder")} autoComplete="current-password" shown={shown} onToggle={onToggle} error={fieldError(form.formState.errors.password?.message)} register={form.register("password")} />
      <div className="-mt-1 flex justify-end">
        <button type="button" onClick={onForgot} className="min-h-[44px] border-0 bg-transparent px-[2px] text-[13px] font-bold text-cc-gold hover:text-cc-gold-hover">{t("auth.forgot")}</button>
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending}>{t("auth.submitSignIn")}</Button>
    </form>
  );
}

function TotpForm({ onSubmit, pending, fieldError }: { onSubmit: (v: z.infer<typeof totpSchema>) => Promise<void>; pending: boolean; fieldError: FieldError }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof totpSchema>>({ resolver: zodResolver(totpSchema), defaultValues: { totpCode: "" } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
      <Field label={t("account.security.totpCodeLabel")} htmlFor="auth-totp" error={fieldError(form.formState.errors.totpCode?.message)}>
        <Input id="auth-totp" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} autoFocus aria-invalid={!!form.formState.errors.totpCode} className="tracking-[6px]" {...form.register("totpCode")} />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>{t("auth.submitTotp")}</Button>
    </form>
  );
}

function RegisterForm({ contact, onSubmit, pending, shown, onToggle, fieldError }: { contact: Contact; onSubmit: (v: RegisterValues) => Promise<void>; pending: boolean; shown: boolean; onToggle: () => void; fieldError: FieldError }) {
  const { t } = useTranslation();
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema(contact)), defaultValues: { login: "", password: "", consent: undefined as unknown as true } });
  const consent = form.watch("consent");
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
      <LoginField id="reg-login" contact={contact} autoComplete={contact === "email" ? "email" : "tel-national"} error={fieldError(form.formState.errors.login?.message)} register={form.register("login")} />
      <PasswordField id="reg-password" label={t("auth.passwordLabel")} placeholder={t("auth.createPasswordPlaceholder")} autoComplete="new-password" shown={shown} onToggle={onToggle} error={fieldError(form.formState.errors.password?.message)} hint={t("auth.passwordHint")} register={form.register("password")} />
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={!!consent}
          aria-labelledby="reg-consent-label"
          onClick={() => form.setValue("consent", (consent ? undefined : true) as unknown as true, { shouldValidate: form.formState.isSubmitted })}
          className={cn("mt-[1px] flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border text-[14px] font-extrabold leading-none text-[#2c1400] transition-colors", consent ? "border-cc-gold bg-[image:var(--cc-gold-cta)]" : "border-cc-line-strong bg-white/[.04]")}
        >
          {consent ? "✓" : ""}
        </button>
        <span id="reg-consent-label" className="min-w-0 flex-1 text-[12.5px] font-medium leading-[1.55] text-cc-lavender text-pretty">
          <Trans i18nKey="auth.consent" components={{ terms: <a href="/info/terms" target="_blank" rel="noopener" className="font-bold" />, privacy: <a href="/info/privacy" target="_blank" rel="noopener" className="font-bold" /> }} />
        </span>
      </div>
      {form.formState.errors.consent ? <span role="alert" className="-mt-2 text-[12px] font-semibold text-cc-danger">{t("auth.consentRequired")}</span> : null}
      <Button type="submit" variant="primary" size="lg" loading={pending}>{t("auth.submitRegister")}</Button>
    </form>
  );
}

function ResetForm({ contact, onSubmit, pending, fieldError }: { contact: Contact; onSubmit: (v: ResetValues) => Promise<void>; pending: boolean; fieldError: FieldError }) {
  const { t } = useTranslation();
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema(contact)), defaultValues: { login: "" } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
      <LoginField id="reset-login" contact={contact} autoComplete="username" error={fieldError(form.formState.errors.login?.message)} register={form.register("login")} />
      <p className="m-0 text-[12.5px] font-medium leading-[1.55] text-cc-muted text-pretty">{t(contact === "phone" ? "auth.resetNotePhone" : "auth.resetNote")}</p>
      <Button type="submit" variant="primary" size="lg" loading={pending}>{t("auth.submitReset")}</Button>
    </form>
  );
}

function ResetConfirmForm({ contact, login: initial, onSubmit, pending, shown, onToggle, fieldError }: { contact: Contact; login: string; onSubmit: (v: ResetConfirmValues) => Promise<void>; pending: boolean; shown: boolean; onToggle: () => void; fieldError: FieldError }) {
  const { t } = useTranslation();
  const form = useForm<ResetConfirmValues>({ resolver: zodResolver(resetConfirmSchema(contact)), defaultValues: { login: initial, otp: "", newPassword: "" } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
      <LoginField id="rc-login" contact={contact} autoComplete="username" error={fieldError(form.formState.errors.login?.message)} register={form.register("login")} />
      <Field label={t("auth.otpLabel")} htmlFor="rc-otp" error={fieldError(form.formState.errors.otp?.message)}>
        <Input id="rc-otp" inputMode="numeric" autoComplete="one-time-code" placeholder={t("auth.otpPlaceholder")} maxLength={6} aria-invalid={!!form.formState.errors.otp} className="tracking-[6px]" {...form.register("otp")} />
      </Field>
      <PasswordField id="rc-password" label={t("auth.newPasswordLabel")} placeholder={t("auth.createPasswordPlaceholder")} autoComplete="new-password" shown={shown} onToggle={onToggle} error={fieldError(form.formState.errors.newPassword?.message)} hint={t("auth.passwordHint")} register={form.register("newPassword")} />
      <Button type="submit" variant="primary" size="lg" loading={pending}>{t("auth.submitResetConfirm")}</Button>
    </form>
  );
}

/** P3-24: the SMS code sign-up by phone sent. Confirming is not a gate — "Later" closes the dialog, signed in. */
function VerifyPhoneForm({ onSubmit, onResend, onLater, pending, resending, fieldError }: {
  onSubmit: (v: z.infer<typeof codeSchema>) => Promise<void>; onResend: () => void; onLater: () => void; pending: boolean; resending: boolean; fieldError: FieldError;
}) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
      <Field label={t("auth.verifyPhoneCodeLabel")} htmlFor="vp-code" error={fieldError(form.formState.errors.code?.message)}>
        <Input id="vp-code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} autoFocus aria-invalid={!!form.formState.errors.code} className="tracking-[6px]" {...form.register("code")} />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>{t("auth.verifyPhoneSubmit")}</Button>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onResend} disabled={resending} className="min-h-[44px] border-0 bg-transparent px-[2px] text-[13px] font-bold text-cc-gold hover:text-cc-gold-hover disabled:opacity-60">{t("auth.verifyPhoneResend")}</button>
        <button type="button" onClick={onLater} className="min-h-[44px] border-0 bg-transparent px-[2px] text-[13px] font-bold text-cc-lavender hover:text-cc-ink">{t("auth.verifyPhoneLater")}</button>
      </div>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.1 35.3 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
