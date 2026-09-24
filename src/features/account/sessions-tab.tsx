import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useLogout, useLogoutEverywhere, useRevokeSession, useSession, useSessionState } from "@/features/auth/session";

/** Own sessions (P3-16 acceptance: "sees their sessions"), per-device sign-out and sign-out-everywhere. */
export function SessionsTab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { disarm } = useSession();
  const state = useSessionState();
  const revoke = useRevokeSession();
  const logout = useLogout();
  const everywhere = useLogoutEverywhere();
  const errorText = (code: string) => t(`auth.error.${code}`, { defaultValue: t("auth.error.UNKNOWN") });
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  const sessions = state.data?.signedIn ? state.data.sessions : [];

  const signOut = (all: boolean) => {
    disarm();
    const m = all ? everywhere : logout;
    m.mutate(undefined, {
      onSettled: () => {
        toast.success(t(all ? "account.sessions.signedOutEverywhere" : "auth.signedOut"));
        void navigate({ to: "/" });
      },
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-cc-xl border border-cc-line bg-cc-surface p-5">
      <div>
        <h2 className="m-0 text-[18px] font-extrabold tracking-[-0.3px]">{t("account.sessions.title")}</h2>
        <p className="m-0 mt-1 text-[13px] leading-[1.5] text-cc-lavender">{t("account.sessions.intro")}</p>
      </div>
      {state.isError ? <Notice tone="error">{errorText("UNKNOWN")}</Notice> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-cc-lg border border-cc-line bg-white/[.03] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-bold">
                <span className="truncate">{s.userAgent ?? t("account.sessions.unknownDevice")}</span>
                {s.current ? <span className="flex-none rounded-full border border-[rgba(255,201,60,.42)] bg-[rgba(255,201,60,.12)] px-2 py-[2px] text-[10.5px] font-extrabold uppercase tracking-[1px] text-cc-gold">{t("account.sessions.thisDevice")}</span> : null}
              </div>
              <div className="mt-1 text-[12px] text-cc-lavender">{s.ipAddress ?? "—"} · {t("account.sessions.since")} {when(s.createdAt)} · {t("account.sessions.lastSeen")} {when(s.lastSeenAt)}</div>
            </div>
            {s.current ? (
              <Button variant="secondary" size="sm" loading={logout.isPending} onClick={() => signOut(false)}>{t("nav.signOut")}</Button>
            ) : (
              <Button variant="ghost" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate({ sessionId: s.id }, { onSuccess: () => toast.success(t("account.sessions.revoked")), onError: (e) => toast.error(errorText(e.errorCode)) })}>{t("account.sessions.signOutDevice")}</Button>
            )}
          </li>
        ))}
      </ul>
      <Button variant="danger" className="self-start" loading={everywhere.isPending} onClick={() => signOut(true)}>{t("account.sessions.signOutEverywhere")}</Button>
    </section>
  );
}
