import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/layout/shell";
import { LuckyWheel } from "@/features/wheel/lucky-wheel";

export const Route = createFileRoute("/lucky-wheel")({ component: LuckyWheelPage });

/**
 * The bottom nav's Lucky Wheel (design: Home's wheel dialog, here a page of its own — phones first): one free spin a
 * day, for guests too up to the Spin, which asks them to sign in. The Shell leaves room for the fixed bottom nav.
 */
function LuckyWheelPage() {
  return (
    <Shell>
      <LuckyWheel />
    </Shell>
  );
}
