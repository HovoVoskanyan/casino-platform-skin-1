import { createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { SectionTitle } from "@/components/ui/section-title";
import { Notice } from "@/components/ui/notice";

const PAGES = ["responsible-gaming", "faq", "terms", "privacy"] as const;
type InfoPage = (typeof PAGES)[number];

export const Route = createFileRoute("/info/$page")({
  beforeLoad: ({ params }) => {
    if (!(PAGES as readonly string[]).includes(params.page)) throw notFound();
  },
  component: InfoPageView,
});

/** Design (Info): one reading layout, four destinations; the copy is the owner's unapproved draft until they sign it off (P3-22 open item). */
function InfoPageView() {
  const { t } = useTranslation();
  const { page } = Route.useParams();
  return (
    <Shell>
      <SectionTitle>{t(`info.${page as InfoPage}`)}</SectionTitle>
      <Notice tone="info">{t("info.draft")}</Notice>
    </Shell>
  );
}
