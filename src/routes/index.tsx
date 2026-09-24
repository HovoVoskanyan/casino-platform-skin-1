import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { SectionTitle } from "@/components/ui/section-title";
import { Notice } from "@/components/ui/notice";

export const Route = createFileRoute("/")({ component: HomePage });

/**
 * Home (design: hero carousel, Hot Games, Quick Play, Bonuses, Payments, trust strip). The hero and the rails read
 * core's player content once P3-23 publishes it; until then the sections are the design's frames with an honest
 * notice, never fixture data pretending to be a catalogue.
 */
function HomePage() {
  const { t } = useTranslation();
  return (
    <Shell>
      <section aria-roledescription="carousel" aria-label={t("nav.promotions")} className="-mt-3 flex aspect-[321/136] items-center justify-center rounded-[clamp(14px,2.2vw,20px)] border border-[rgba(167,139,250,.22)] bg-cc-surface shadow-[0_20px_50px_rgba(6,3,11,.6)]">
        <span className="px-4 text-center text-[12px] font-extrabold uppercase tracking-[1.2px] text-cc-muted">Banner slot — home-hero 1956×829</span>
      </section>
      {(["Hot Games", "Quick Play", "Bonuses"] as const).map((title) => (
        <section key={title} className="flex flex-col gap-[22px]">
          <SectionTitle>{title}</SectionTitle>
          <Notice tone="info">{t("shell.comingSoon")}</Notice>
        </section>
      ))}
    </Shell>
  );
}
