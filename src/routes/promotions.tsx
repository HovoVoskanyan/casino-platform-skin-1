import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHero, Shell } from "@/components/layout/shell";
import { Notice } from "@/components/ui/notice";

export const Route = createFileRoute("/promotions")({ component: PromotionsPage });

/** Design: the promotions page hero is HTML with the logo; the body arrives with its service (P3-23 / P5-07). */
function PromotionsPage() {
  const { t } = useTranslation();
  return (
    <Shell>
      <PageHero title={t("promotions.title")} subtitle={t("promotions.subtitle")} />
      <Notice tone="info">{t("shell.comingSoon")}</Notice>
    </Shell>
  );
}
