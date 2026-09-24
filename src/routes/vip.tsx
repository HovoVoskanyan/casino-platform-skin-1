import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHero, Shell } from "@/components/layout/shell";
import { Notice } from "@/components/ui/notice";

export const Route = createFileRoute("/vip")({ component: VipPage });

/** Design: the vip page hero is HTML with the logo; the body arrives with its service (P3-23 / P5-07). */
function VipPage() {
  const { t } = useTranslation();
  return (
    <Shell>
      <PageHero title={t("vip.title")} subtitle={t("vip.subtitle")} />
      <Notice tone="info">{t("shell.comingSoon")}</Notice>
    </Shell>
  );
}
