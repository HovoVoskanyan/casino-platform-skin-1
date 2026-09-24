import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHero, Shell } from "@/components/layout/shell";
import { Notice } from "@/components/ui/notice";

export const Route = createFileRoute("/games")({ component: GamesPage });

/** Design: the games page hero is HTML with the logo; the body arrives with its service (P3-23 / P5-07). */
function GamesPage() {
  const { t } = useTranslation();
  return (
    <Shell>
      <PageHero title={t("games.title")} subtitle={t("games.subtitle")} />
      <Notice tone="info">{t("shell.comingSoon")}</Notice>
    </Shell>
  );
}
