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
import { accountErrorText, formatPlayerNumber, useProfile, useUpdateProfile, type Profile } from "./api";

const schema = z.object({
  displayName: z.string().trim().refine((v) => v === "" || (v.length >= 3 && v.length <= 20 && /^[\p{L}\p{N} ._-]+$/u.test(v)), "account.profile.displayNameRule"),
  city: z.string().trim().max(60, "account.profile.cityRule"),
});

/**
 * Design (My Account → Profile): the player number, the display name (3–20, shown on leaderboards) and the city. The
 * registered name and date of birth come from verification (P3-25); ChoCho runs without it (owner 2026-09-27), so
 * they are not shown at all rather than shown empty.
 */
export function ProfileTab() {
  const { t } = useTranslation();
  const profile = useProfile();
  if (profile.isPending) return <div aria-hidden className="h-[260px] animate-pulse rounded-cc-xl border border-cc-line bg-cc-surface-raised" />;
  if (profile.isError) return <Notice tone="error">{t("common.loadFailed")}</Notice>;
  return <ProfileForm profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { displayName: profile.displayName ?? "", city: profile.city ?? "" } });
  const fe = (m?: string) => (m ? t(m) : undefined);

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const saved = await update.mutateAsync({ displayName: v.displayName || null, city: v.city || null });
      form.reset({ displayName: saved.displayName ?? "", city: saved.city ?? "" });
      toast.success(t("account.profile.saved"));
    } catch (e) {
      setError(accountErrorText(t, (e as { errorCode?: string }).errorCode));
    }
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AccountCard title={t("account.profile.title")} intro={t("account.profile.intro")}>
        <div className="flex flex-col gap-1 rounded-cc-lg border border-cc-line bg-white/[.02] px-4 py-3">
          <span className="text-[11.5px] font-bold tracking-[.8px] text-cc-muted uppercase">{t("account.profile.playerId")}</span>
          <span className="font-mono text-[18px] font-extrabold tracking-[1px] text-cc-ink">{formatPlayerNumber(profile.playerNumber)}</span>
          <span className="text-[12px] text-cc-lavender">{t("account.profile.playerIdHint")}</span>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label={t("account.profile.displayName")} htmlFor="pf-name" hint={t("account.profile.displayNameHint")} error={fe(form.formState.errors.displayName?.message)}>
            <Input id="pf-name" autoComplete="nickname" maxLength={20} aria-invalid={!!form.formState.errors.displayName} {...form.register("displayName")} />
          </Field>
          <Field label={t("account.profile.city")} htmlFor="pf-city" error={fe(form.formState.errors.city?.message)}>
            <Input id="pf-city" autoComplete="address-level2" maxLength={60} aria-invalid={!!form.formState.errors.city} {...form.register("city")} />
          </Field>
          <Button type="submit" variant="primary" className="self-start" loading={update.isPending} disabled={!form.formState.isDirty}>{t("account.profile.save")}</Button>
        </form>
      </AccountCard>
    </div>
  );
}
