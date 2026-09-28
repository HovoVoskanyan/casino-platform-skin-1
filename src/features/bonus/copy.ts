import type { TFunction } from "i18next";
import { SKIN_CURRENCY, peso, pesoWhole } from "@/lib/money";
import type { Balance } from "@/features/wallet/balance-store";
import type { BonusDefinition, ClaimableFreeBet, PlayerBonus, PlayerFreeBet } from "./api";

/**
 * P3-29 — the words on a bonus card, built from what bonus returns. The design's cards carry a reward line, a
 * deadline, a one-line conditions summary and a terms list; bonus has no copy fields beyond `description`, so every
 * line here is derived from the definition's own numbers. Nothing is promised that the engine does not enforce.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "28 Sep 2026, 11:59 PM" — the design's date form, in the player's time zone. Built by hand: en-PH's own short date
 * is "Sep 28, 2026", and ICU spells September "Sept" in some locales.
 */
export function when(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

type Step = BonusDefinition["steps"][number];

/** The step a claim here would earn first: the lowest in the skin's currency. */
export function firstStep(b: BonusDefinition): Step | undefined {
  return [...(b.steps ?? [])].filter((s) => s.currency?.toUpperCase() === SKIN_CURRENCY).sort((a, z) => a.stepNumber - z.stepNumber)[0];
}

const bands = (step: Step | undefined) => [...(step?.intervals ?? [])].sort((a, z) => a.minDepositCents - z.minDepositCents);
const multiplierOf = (b: BonusDefinition, step: Step | undefined) => step?.wageringMultiplier ?? b.wageringMultiplier ?? null;
const distinctSteps = (b: BonusDefinition) => new Set((b.steps ?? []).map((s) => s.stepNumber)).size;

/** The smallest deposit that earns the first step, if the definition says. */
export function minDeposit(b: BonusDefinition): number | null {
  return bands(firstStep(b))[0]?.minDepositCents ?? null;
}

export function bonusReward(t: TFunction, b: BonusDefinition): string {
  const step = firstStep(b);
  const band = bands(step)[0];
  const parts: string[] = [];
  if (band && band.bonusPercent > 0) {
    const cap = band.maxBonusCents ?? step?.maxBonusAmountCents ?? null;
    parts.push(cap ? t("bonus.reward.percentCap", { percent: band.bonusPercent, cap: pesoWhole(cap) }) : t("bonus.reward.percent", { percent: band.bonusPercent }));
  }
  if (step?.freeSpins) parts.push(t("bonus.reward.spins", { count: step.freeSpins }));
  return parts.join(" + ") || (b.description ?? b.name);
}

export function bonusConditions(t: TFunction, b: BonusDefinition): string {
  const min = minDeposit(b);
  const multiplier = multiplierOf(b, firstStep(b));
  const lines = [
    min ? t("bonus.conditions.deposit", { min: pesoWhole(min) }) : null,
    multiplier ? t("bonus.conditions.wagering", { multiplier }) : null,
    (b.allowedGameIds ?? []).length ? t("bonus.conditions.someGames") : null,
  ];
  return lines.filter(Boolean).join(" ");
}

export function bonusTerms(t: TFunction, b: BonusDefinition): string[] {
  const step = firstStep(b);
  const multiplier = multiplierOf(b, step);
  const terms: (string | null)[] = [
    b.description?.trim() || null,
    t("bonus.terms.howItWorks"),
    ...bands(step).map((band) => {
      const cap = band.maxBonusCents ?? step?.maxBonusAmountCents ?? null;
      const range = band.maxDepositCents
        ? t("bonus.terms.band", { min: pesoWhole(band.minDepositCents), max: pesoWhole(band.maxDepositCents) })
        : t("bonus.terms.bandFrom", { min: pesoWhole(band.minDepositCents) });
      return `${range}: ${cap ? t("bonus.reward.percentCap", { percent: band.bonusPercent, cap: pesoWhole(cap) }) : t("bonus.reward.percent", { percent: band.bonusPercent })}.`;
    }),
    step?.freeSpins ? t("bonus.terms.spins", { count: step.freeSpins }) : null,
    multiplier ? t("bonus.terms.wagering", { multiplier }) : null,
    t("bonus.terms.bonusPlayOnly"),
    (b.allowedGameIds ?? []).length ? t("bonus.terms.someGames", { count: b.allowedGameIds.length }) : t("bonus.terms.allGames"),
    (b.gameContributions ?? []).some((c) => c.contributionPercent < 100) ? t("bonus.terms.contributions") : null,
    b.minQualifyingStakeCents ? t("bonus.terms.minStake", { min: peso(b.minQualifyingStakeCents) }) : null,
    b.maxQualifyingStakeCents ? t("bonus.terms.maxStake", { max: peso(b.maxQualifyingStakeCents) }) : null,
    distinctSteps(b) > 1 ? t("bonus.terms.steps", { count: distinctSteps(b) }) : null,
    t("bonus.terms.forfeit"),
    t("bonus.terms.usesCompleted", { count: b.maxUsesPerPlayer }),
    when(b.endAt) ? t("bonus.terms.ends", { date: when(b.endAt) }) : null,
  ];
  return terms.filter((x): x is string => !!x);
}

/** "25 free spins on Sweet Bonanza" — the game's name when there is one game and its name is known. */
export function spinsReward(t: TFunction, count: number, gameIds: string[], gameName: string | null): string {
  if (gameIds.length === 1 && gameName) return t("bonus.reward.spinsOn", { count, game: gameName });
  if (gameIds.length > 1) return t("bonus.reward.spinsEach", { count, games: gameIds.length });
  return t("bonus.reward.spins", { count });
}

export function spinsOfferTerms(t: TFunction, c: ClaimableFreeBet, gameName: string | null): string[] {
  return [
    c.description?.trim() || null,
    spinsReward(t, c.spinsPerGame, c.gameIds, gameName) + ".",
    t("bonus.spins.addedNow"),
    when(c.expireAt) ? t("bonus.spins.expire", { date: when(c.expireAt) }) : null,
    t("bonus.spins.usesLeft", { count: c.usesRemaining }),
  ].filter((x): x is string => !!x);
}

export interface Progress { done: number; target: number; label: string }

/** A running bonus: credit granted, what is left (the hub, when the funds are this bonus's), wagering, expiry. */
export function runningCopy(t: TFunction, row: PlayerBonus, definition: BonusDefinition | undefined, balance: Balance | null, hidden: boolean) {
  const show = (cents: number) => (hidden ? "••••••" : peso(cents));
  const multiplier = definition ? multiplierOf(definition, firstStep(definition)) : null;
  const target = row.wageringRequiredCents;
  const progress: Progress | null = target > 0
    ? {
        done: row.wageringCompletedCents,
        target,
        label: multiplier
          ? t("bonus.progressMultiplier", { multiplier, done: show(row.wageringCompletedCents), target: show(target) })
          : t("bonus.progress", { done: show(row.wageringCompletedCents), target: show(target) }),
      }
    : null;
  const own = balance && row.playerBonusId && balance.activeBonusRef === row.playerBonusId;
  return {
    reward: t("bonus.reward.credit", { amount: show(row.grantedCents) }),
    remaining: own ? t("bonus.remaining", { left: show(balance.bonusCents), total: show(row.grantedCents) }) : null,
    progress,
    expiry: when(row.expiresAt) ? t("bonus.expires", { date: when(row.expiresAt) }) : null,
    details: [
      target > 0 ? t("bonus.details.wagering", { target: show(target), left: show(row.wageringRemainingCents) }) : null,
      target > 0 ? t("bonus.terms.bonusPlayOnly") : null,
      row.totalSteps > 1 && row.currentStepNumber ? t("bonus.details.step", { step: row.currentStepNumber, total: row.totalSteps }) : null,
      t("bonus.details.choose"),
      t("bonus.terms.forfeit"),
      t("bonus.details.expiry"),
    ].filter((x): x is string => !!x),
  };
}

/**
 * Opted in, waiting for the deposit that grants it. While another bonus runs, a deposit only feeds that one, so the
 * card says the claim waits for it to end instead of promising the next deposit.
 */
export function awaitingCopy(t: TFunction, definition: BonusDefinition | undefined, runningName: string | null = null) {
  const min = definition ? minDeposit(definition) : null;
  return {
    reward: definition ? bonusReward(t, definition) : "",
    remaining: runningName
      ? t("bonus.awaiting.afterCurrent", { current: runningName })
      : min ? t("bonus.awaiting.deposit", { min: pesoWhole(min) }) : t("bonus.awaiting.anyDeposit"),
    expiry: definition && when(definition.endAt) ? t("bonus.awaiting.until", { date: when(definition.endAt) }) : null,
    details: definition ? bonusTerms(t, definition) : [],
  };
}

export function heldSpinsCopy(t: TFunction, f: PlayerFreeBet, gameName: string | null) {
  return {
    // A holding counts its spins across all its games (a claim assigns the campaign's count on each).
    reward: f.gameIds.length > 1 ? t("bonus.reward.spinsAcross", { count: f.totalCount, games: f.gameIds.length }) : spinsReward(t, f.totalCount, f.gameIds, gameName),
    remaining: t("bonus.spins.left", { left: f.remainingCount, total: f.totalCount }),
    expiry: when(f.expiresAt) ? t("bonus.expires", { date: when(f.expiresAt) }) : null,
    details: [
      f.assignmentOutcome === "unknown" ? t("bonus.spins.settingUp") : f.assignmentOutcome === "refused" ? t("bonus.spins.refused") : t("bonus.spins.howToPlay"),
      when(f.expiresAt) ? t("bonus.spins.expire", { date: when(f.expiresAt) }) : null,
    ].filter((x): x is string => !!x),
  };
}
