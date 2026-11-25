import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { LuckyWheel } from "@/features/wheel/lucky-wheel";
import { useSeo } from "@/lib/seo";
import { wheelSeo } from "@/features/lobby/page-seo";

export const Route = createFileRoute("/lucky-wheel")({ component: LuckyWheelPage });

/**
 * The bottom nav's Lucky Wheel (design: Home's wheel dialog, here a page of its own — phones first): one free spin a
 * day, for guests too up to the Spin, which asks them to sign in. The Shell leaves room for the fixed bottom nav.
 */
function LuckyWheelPage() {
  const { t } = useTranslation();
  useSeo(wheelSeo(t));
  return (
    <Shell>
      <LuckyWheel />
    </Shell>
  );
}
