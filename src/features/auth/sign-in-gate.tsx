import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { authDialog } from "./auth-dialog-state";

/** Design (Wallet / My Account as a guest): a sign-in gate over the page, no personal data, the destination kept. */
export function SignInGate({ title, returnTo }: { title: string; returnTo: string }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col items-center gap-4 rounded-cc-xl border border-cc-line bg-cc-surface px-5 py-10 text-center">
      <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.6px]">{title}</h1>
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => authDialog.open("signin", returnTo)}>{t("nav.signIn")}</Button>
        <Button variant="secondary" onClick={() => authDialog.open("register", returnTo)}>{t("nav.register")}</Button>
      </div>
    </section>
  );
}
