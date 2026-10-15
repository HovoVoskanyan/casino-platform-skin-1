import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/problem";
import { Button, Spinner } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { supportPanel } from "@/features/support/support-store";
import { instant, useRefreshWheel, useSpinWheel, useWheel, type Wheel, type WheelSpin } from "./api";
import { formatCountdown, useCountdown } from "./countdown";
import { indexOfSpin, prizeText, resultCopy, zoneCity, type ResultCopy } from "./copy";
import { useWheelMotion } from "./use-wheel-motion";
import { WheelGraphic } from "./wheel-graphic";

const RETURN_TO = "/lucky-wheel";

/** The design's Spin: gold gradient, dark ink, 52px tall, radius 14px. */
const SPIN_BUTTON =
  "inline-flex h-[52px] min-w-[180px] items-center justify-center gap-2 rounded-cc-lg border-0 bg-[image:var(--cc-gold-cta)] px-10 text-[17px] font-extrabold text-[#2c1400] shadow-[0_10px_26px_rgba(235,156,13,.36)] transition-[filter] hover:brightness-105 disabled:opacity-70";
const QUIET_LINK =
  "inline-flex min-h-11 items-center justify-center rounded-cc-md border border-[rgba(167,139,250,.3)] bg-white/[.05] px-4 text-[14px] font-bold text-cc-text hover:bg-white/[.1] hover:text-cc-ink";

/**
 * The Lucky Wheel page (bottom nav → /lucky-wheel): one free spin a day on the skin's wheel. Bonus decides
 * everything — what is on the wheel, whether this player may spin, which slice they land on — and the page shows it:
 * the wheel in the design's dialog card, the Spin, the prize, and how long until the next one.
 */
export function LuckyWheel() {
  const { t } = useTranslation();
  const wheel = useWheel();
  const data = wheel.data;

  let body: ReactNode;
  if (wheel.isPending) body = <WheelSkeleton />;
  else if (!data) {
    body = (
      <div className="flex w-full flex-col items-center gap-4">
        <Notice tone="error" className="w-full max-w-[420px]">{t("wheel.loadFailed")}</Notice>
        <Button variant="secondary" className="min-h-11" onClick={() => void wheel.refetch()} loading={wheel.isFetching}>{t("wheel.retry")}</Button>
      </div>
    );
  } else if (isResting(data)) body = <Resting data={data} />;
  else body = <WheelPlay data={data} />;

  return (
    <>
      <section
        aria-labelledby="lucky-wheel-title"
        className="relative flex flex-col items-center gap-[18px] overflow-hidden rounded-[22px] border border-[rgba(255,201,60,.4)] bg-[linear-gradient(160deg,#2c1050,#150726)] px-4 pt-6 pb-7 shadow-[0_24px_60px_rgba(6,3,11,.6)] min-[600px]:px-7 min-[600px]:pt-7 short:gap-3 short:pt-4 short:pb-5"
      >
        <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[260px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,201,60,.16)_0%,transparent_70%)]" />
        <div className="relative flex flex-col items-center gap-1 text-center">
          <h1 id="lucky-wheel-title" className="m-0 text-[24px] leading-[1.15] font-extrabold tracking-[-0.4px] text-cc-ink min-[600px]:text-[28px] short:text-[21px]">{data?.name?.trim() || t("wheel.title")}</h1>
          <p className="m-0 text-[13.5px] leading-[1.5] font-medium text-pretty text-cc-lavender short:hidden">{t("wheel.subtitle")}</p>
        </div>
        <div className="relative w-full">{body}</div>
      </section>
      <Rules timeZone={data?.timeZone} />
    </>
  );
}

/** States with no wheel to play: switched off, ended, this player barred — or a wheel with no slices. */
function isResting(data: Wheel): boolean {
  if (data.state === "unavailable" || data.state === "ended" || data.state === "restricted") return true;
  return data.segments.length === 0 && !data.todaySpin;
}

function WheelSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="flex w-full flex-col items-center gap-[18px] short:flex-row short:justify-center short:gap-8">
      <span className="sr-only">{t("wheel.loading")}</span>
      <span aria-hidden className="aspect-square w-[min(280px,64vw)] animate-pulse rounded-full border-[8px] border-[rgba(255,201,60,.35)] bg-cc-surface-raised short:w-[min(230px,52vh)]" />
      <span aria-hidden className="flex w-full max-w-[360px] flex-col items-center gap-4">
        <span className="h-4 w-4/5 animate-pulse rounded-full bg-cc-surface-raised" />
        <span className="h-[52px] w-[180px] animate-pulse rounded-cc-lg bg-cc-surface-raised" />
      </span>
    </div>
  );
}

function Resting({ data }: { data: Wheel }) {
  const { t } = useTranslation();
  const key = data.state === "ended" ? "ended" : data.state === "restricted" ? "restricted" : "resting";
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <img src="/nav-wheel.png" alt="" className="h-[84px] w-[84px] object-contain opacity-80 drop-shadow-[0_8px_16px_rgba(0,0,0,.6)] grayscale-[35%]" />
      <div role="status" className="flex max-w-[420px] flex-col gap-2">
        <h2 className="m-0 text-[19px] font-extrabold text-[#ffd98a]">{t(`wheel.${key}.title`)}</h2>
        <p className="m-0 text-[14px] leading-[1.55] font-medium text-pretty text-cc-lavender">{t(`wheel.${key}.body`)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {key === "restricted" ? (
          <button type="button" className={QUIET_LINK} onClick={(e) => supportPanel.open(e.currentTarget)}>{t("wheel.contactSupport")}</button>
        ) : null}
        <Link to="/" className={cn(SPIN_BUTTON, "min-w-0 px-7 text-[15.5px] hover:text-[#2c1400]")}>{t("wheel.backHome")}</Link>
      </div>
    </div>
  );
}

type Phase = "idle" | "waiting" | "landing";

/** The wheel itself, the Spin, and whatever today holds: the prize, the countdown, or why there is nothing to spin. */
function WheelPlay({ data }: { data: Wheel }) {
  const { t } = useTranslation();
  const spinner = useSpinWheel();
  const refresh = useRefreshWheel();
  const motion = useWheelMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<WheelSpin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const landed = useRef<string | null>(null);
  const placedFor = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const segments = data.segments;
  const n = segments.length;
  const today = data.todaySpin ?? null;
  const shown = result ?? today;

  // Where the wheel rests when nothing is spinning: on today's slice (a reload after the spin), else on slice 0.
  // Never under a spin in flight, and never back onto a slice it has just animated to (the refetch after a spin).
  useLayoutEffect(() => {
    if (busy.current || n === 0) return;
    if (today ? landed.current === today.spinId && placedFor.current === n : placedFor.current === n) return;
    motion.rest(today ? Math.max(0, indexOfSpin(segments, today)) : 0, n);
    placedFor.current = n;
    landed.current = today?.spinId ?? null;
  }, [today, segments, n, motion]);

  const countdownTarget = data.state === "closedToday" || data.state === "spunToday" || shown ? instant(data.nextSpinAt) ?? instant(shown?.nextSpinAt) : null;
  const remaining = useCountdown(countdownTarget, data.clockOffsetMs, () => {
    // a new wheel day: yesterday's prize goes, the wheel is read again
    setResult(null);
    void refresh();
  });

  async function spin() {
    if (busy.current) return;
    if (data.state === "signInRequired") {
      authDialog.open("signin", RETURN_TO);
      return;
    }
    busy.current = true;
    setError(null);
    setPhase("waiting");
    motion.startWaiting();
    try {
      const s = await spinner.mutateAsync();
      const index = indexOfSpin(segments, s);
      if (s.replayed || index < 0) {
        // today's spin already existed (another tab, a lost answer): no show, just where it landed
        motion.rest(Math.max(0, index), n);
      } else {
        setPhase("landing");
        await motion.land(index, n);
      }
      landed.current = s.spinId;
      placedFor.current = n;
      setResult(s);
      if (document.activeElement === document.body || !document.activeElement) resultRef.current?.focus();
    } catch (e) {
      motion.coast();
      const err = toApiError(e);
      if (err.errorCode === "WHEEL_NOT_AVAILABLE") setError(t("wheel.error.notAvailable"));
      else if (err.errorCode !== "PLAYER_RESTRICTED") setError(t("wheel.error.generic"));
    } finally {
      busy.current = false;
      setPhase("idle");
      void refresh();
    }
  }

  const spinning = phase !== "idle";
  const ineligible = segments.some((s) => !s.eligible);
  const canSpin = !shown && (data.state === "ready" || data.state === "signInRequired");

  let message: ReactNode = null;
  if (spinning) message = <Line>{t("wheel.message.spinning")}</Line>;
  else if (shown) message = <Result copy={resultCopy(t, shown)} />;
  else if (data.state === "ready") message = <Line>{t("wheel.message.ready")}</Line>;
  else if (data.state === "signInRequired") message = <Line>{t("wheel.message.guest")}</Line>;
  else if (data.state === "closedToday") message = <StateCopy title={t("wheel.closed.title")} body={t("wheel.closed.body")} />;
  else if (data.state === "nothingToWin") message = <StateCopy title={t("wheel.nothingToWin.title")} body={t("wheel.nothingToWin.body")} />;
  else if (data.state === "spunToday") message = <Line>{t("wheel.result.comeBack")}</Line>;

  return (
    <div className="flex w-full flex-col items-center gap-[18px] short:flex-row short:items-center short:justify-center short:gap-8">
      {n > 0 ? <WheelGraphic segments={segments} currency={data.currency} rotorRef={motion.rotor} /> : null}

      <div className="flex w-full max-w-[420px] min-w-0 flex-col items-center gap-4 text-center short:max-w-[380px] short:gap-3">
        <div ref={resultRef} tabIndex={-1} role="status" aria-live="polite" className="flex min-h-[22px] w-full flex-col items-center outline-none">
          {message}
        </div>

        {error ? <Notice tone="info" role="alert" className="w-full text-left">{error}</Notice> : null}

        {canSpin || spinning ? (
          <button
            type="button"
            className={SPIN_BUTTON}
            onClick={() => void spin()}
            disabled={spinning}
            aria-busy={spinning || undefined}
            aria-label={spinning ? undefined : data.state === "signInRequired" ? t("wheel.signInToSpinLabel") : t("wheel.spinLabel")}
          >
            {spinning ? <><Spinner />{t("wheel.spinning")}</> : data.state === "signInRequired" ? t("wheel.signInToSpin") : t("wheel.spin")}
          </button>
        ) : null}

        {remaining !== null && !spinning && (shown || data.state === "closedToday" || data.state === "spunToday") ? (
          <div className="flex flex-col items-center gap-1 rounded-cc-lg border border-[rgba(255,201,60,.28)] bg-[rgba(255,201,60,.06)] px-5 py-3 short:py-2">
            <span className="text-[12px] font-bold tracking-[.6px] text-cc-lavender uppercase">{t(shown || data.state === "spunToday" ? "wheel.nextSpin" : "wheel.opensIn")}</span>
            <span role="timer" className="tabular text-[28px] leading-[1.1] font-extrabold tracking-[.5px] text-cc-gold short:text-[24px]">{formatCountdown(remaining)}</span>
          </div>
        ) : null}

        {!spinning && !shown && data.state === "nothingToWin" ? (
          <Link to="/account" search={{ tab: "bonuses" }} className={QUIET_LINK}>{t("wheel.viewBonuses")}</Link>
        ) : null}

        {ineligible && data.state !== "nothingToWin" && !shown ? (
          <p className="m-0 text-[12.5px] leading-[1.5] font-medium text-pretty text-cc-muted">{t("wheel.ineligibleNote")}</p>
        ) : null}

        <PrizeList data={data} />
      </div>
    </div>
  );
}

function Line({ children }: { children: ReactNode }) {
  return <p className="m-0 min-h-[22px] text-[14px] leading-[1.55] font-semibold text-pretty text-[#cbb6e6]">{children}</p>;
}

function StateCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="m-0 text-[18px] font-extrabold text-[#ffd98a]">{title}</h2>
      <p className="m-0 text-[14px] leading-[1.55] font-medium text-pretty text-cc-lavender">{body}</p>
    </div>
  );
}

const TONES: Record<ResultCopy["tone"], string> = {
  win: "border-[rgba(255,201,60,.45)] bg-[rgba(255,201,60,.09)]",
  pending: "border-[rgba(255,201,60,.35)] bg-[rgba(255,201,60,.06)]",
  none: "border-cc-line bg-white/[.03]",
  failed: "border-[rgba(248,113,113,.36)] bg-[rgba(248,113,113,.08)]",
};

function Result({ copy }: { copy: ResultCopy }) {
  const { t } = useTranslation();
  return (
    <div data-testid="wheel-result" className={cn("flex w-full animate-cc-rise flex-col items-center gap-2 rounded-cc-xl border px-4 py-4 short:gap-1 short:py-3", TONES[copy.tone])}>
      <h2 className={cn("m-0 text-[21px] leading-[1.25] font-extrabold tracking-[-0.3px] text-pretty", copy.tone === "none" ? "text-cc-ink" : "text-cc-gold")}>{copy.headline}</h2>
      <p className="m-0 text-[13.5px] leading-[1.55] font-medium text-pretty text-cc-text">{copy.body}</p>
      {copy.link === "bonuses" ? (
        <Link to="/account" search={{ tab: "bonuses" }} className={cn(QUIET_LINK, "mt-1")}>{t("wheel.viewBonuses")}</Link>
      ) : copy.link === "support" ? (
        <button type="button" className={cn(QUIET_LINK, "mt-1")} onClick={(e) => supportPanel.open(e.currentTarget)}>{t("wheel.contactSupport")}</button>
      ) : null}
    </div>
  );
}

/** The wheel in words, for screen readers: every prize, and which cannot be won right now. */
function PrizeList({ data }: { data: Wheel }) {
  const { t } = useTranslation();
  if (data.segments.length === 0) return null;
  return (
    <div className="sr-only">
      <h2>{t("wheel.prizesHeading")}</h2>
      <ul>
        {data.segments.map((s) => {
          const prize = prizeText(t, s, data.currency);
          return <li key={s.id}>{s.eligible ? prize : t("wheel.prizeUnavailable", { prize })}</li>;
        })}
      </ul>
    </div>
  );
}

function Rules({ timeZone }: { timeZone: string | null | undefined }) {
  const { t } = useTranslation();
  const city = zoneCity(timeZone);
  const rules = [t("wheel.rules.daily"), city ? t("wheel.rules.reset", { zone: city }) : t("wheel.rules.resetNoZone"), t("wheel.rules.prizes"), t("wheel.rules.fair")];
  return (
    <section aria-labelledby="wheel-rules" className="flex flex-col gap-4">
      <span id="wheel-rules"><SectionTitle>{t("wheel.rules.title")}</SectionTitle></span>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-3 rounded-cc-xl border border-cc-line bg-white/[.02] px-4 py-[14px]">
            <span aria-hidden className="mt-[1px] flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[rgba(255,201,60,.14)] text-[12px] font-extrabold text-cc-gold">{i + 1}</span>
            <span className="text-[13.5px] leading-[1.5] font-medium text-pretty text-cc-text">{rule}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
