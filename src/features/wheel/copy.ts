import type { TFunction } from "i18next";
import { wholeIn } from "@/lib/money";
import type { WheelPrizeType, WheelSegment, WheelSpin } from "./api";

interface Prize {
  prizeType: WheelPrizeType;
  amountCents?: number | null;
  freeSpinsCount?: number | null;
  label: string;
}

/** "₱500 bonus" / "10 free spins" from the prize's own numbers; the operator's label when they are missing. */
export function prizeText(t: TFunction, prize: Prize, currency: string | null | undefined): string {
  if (prize.prizeType === "bonusMoney" && prize.amountCents != null) return t("wheel.prize.bonusMoney", { amount: wholeIn(prize.amountCents, currency) });
  if (prize.prizeType === "freeSpins" && prize.freeSpinsCount != null) return t("wheel.prize.freeSpins", { count: prize.freeSpinsCount });
  return prize.label;
}

/** Where a result points the player next. */
export type ResultLink = "bonuses" | "support" | null;
export type ResultTone = "win" | "none" | "pending" | "failed";

export interface ResultCopy {
  tone: ResultTone;
  headline: string;
  body: string;
  link: ResultLink;
}

/**
 * The result panel's words for a spin. Never an internal reason: a prize that could not be credited says so and
 * sends the player to support; one still being credited says it is on its way.
 */
export function resultCopy(t: TFunction, spin: WheelSpin): ResultCopy {
  const won = spin.prizeType !== "noPrize";
  if (spin.outcome === "noPrize" || !won) {
    return { tone: "none", headline: t("wheel.result.noPrize"), body: t("wheel.result.noPrizeBody"), link: null };
  }
  const prize = prizeText(t, spin, spin.currency);
  if (spin.outcome === "pending") return { tone: "pending", headline: t("wheel.result.won", { prize }), body: t("wheel.result.pendingBody"), link: "bonuses" };
  if (spin.outcome === "failed") return { tone: "failed", headline: t("wheel.result.won", { prize }), body: t("wheel.result.failedBody"), link: "support" };
  if (spin.prizeType === "freeSpins") {
    return {
      tone: "win",
      headline: spin.freeSpinsCount != null ? t("wheel.result.wonSpins", { count: spin.freeSpinsCount }) : t("wheel.result.won", { prize }),
      body: t("wheel.result.spinsBody"),
      link: "bonuses",
    };
  }
  return {
    tone: "win",
    headline: spin.amountCents != null ? t("wheel.result.wonBonus", { amount: wholeIn(spin.amountCents, spin.currency) }) : t("wheel.result.won", { prize }),
    body: t("wheel.result.bonusBody"),
    link: "bonuses",
  };
}

/** The slice a spin landed on: by id, else by position (a wheel edited since keeps its order). −1 = not on this wheel. */
export function indexOfSpin(segments: WheelSegment[], spin: Pick<WheelSpin, "segmentId" | "segmentPosition">): number {
  const byId = segments.findIndex((s) => s.id === spin.segmentId);
  if (byId >= 0) return byId;
  return segments.findIndex((s) => s.position === spin.segmentPosition);
}

/** "Asia/Manila" → "Manila": the city an IANA zone is named after, for "midnight, Manila time". */
export function zoneCity(timeZone: string | null | undefined): string | null {
  const city = timeZone?.split("/").pop()?.replace(/_/g, " ").trim();
  return city || null;
}
