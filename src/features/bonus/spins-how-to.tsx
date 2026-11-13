import { useTranslation } from "react-i18next";
import { Notice } from "@/components/ui/notice";

/**
 * Owner 2026-11-13: free spins reach the game up to 10 minutes after they are given, and a game already open has to be
 * refreshed to show them. Said wherever a player holds spins that are on a game — My bonuses, the wheel's prize, the
 * game's own page (`lead` = what that place adds first).
 */
export function SpinsHowTo({ lead, className }: { lead?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Notice tone="info" role="note" className={className}>
      <span className="flex flex-col gap-[6px] text-left">
        {lead ? <span>{lead}</span> : null}
        <strong className="font-extrabold">{t("spins.howTo.title")}</strong>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-[18px] font-medium">
          <li>{t("spins.howTo.open")}</li>
          <li>{t("spins.howTo.wait")}</li>
          <li>{t("spins.howTo.refresh")}</li>
        </ol>
      </span>
    </Notice>
  );
}
