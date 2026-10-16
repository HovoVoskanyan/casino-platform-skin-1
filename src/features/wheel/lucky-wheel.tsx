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
import { useGame } from "@/features/lobby/api";
import { instant, newSpinRequestId, spinGameId, useRefreshWheel, useSpinWheel, useWheel, type Wheel, type WheelSpin, type WheelState } from "./api";
import { formatCountdown, useCountdown } from "./countdown";
import { indexOfSpin, prizeText, resultCopy, zoneCity, type ResultCopy } from "./copy";
import { ChoiceCard, PendingChoices, PlayNow } from "./game-choice";
import { GOLD_CTA, QUIET_LINK } from "./styles";
import { useWheelMotion } from "./use-wheel-motion";
import { WheelGraphic } from "./wheel-graphic";

const RETURN_TO = "/lucky-wheel";

/**
 * The Lucky Wheel page (bottom nav → /lucky-wheel): one free spin a day on the skin's wheel. Bonus decides
 * everything — what is on the wheel, whether this player may spin, which slice they land on — and the page shows it:
 * the wheel in the design's dialog card with the Spin in its hub, the prize, and how long until the next one. Free
 * spins won on several games wait for the player to pick one (owner 2026-10-16): today's under the wheel, earlier
 * days' above the wheel — shown even while the wheel is off, so a prize is never stranded.
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

  // today's prize is offered under the wheel itself; the list above holds the rest
  const exclude = data && !isResting(data) ? data.todaySpin?.spinId : null;

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
        {data ? <div className="relative w-full max-w-[720px] empty:hidden"><PendingChoices data={data} exclude={exclude} /></div> : null}
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
      <span aria-hidden className="relative flex aspect-square w-[min(280px,64vw)] animate-pulse items-center justify-center rounded-full border-[8px] border-[rgba(255,201,60,.35)] bg-cc-surface-raised short:w-[min(230px,52vh)]">
        {/* the hub, empty while loading: never a Spin that might not be there */}
        <span className="aspect-square w-[32%] rounded-full border-[3px] border-[rgba(255,201,60,.45)] bg-[#2c1050]" />
      </span>
      <span aria-hidden className="flex w-full max-w-[360px] flex-col items-center gap-3">
        <span className="h-4 w-4/5 animate-pulse rounded-full bg-cc-surface-raised" />
        <span className="h-4 w-3/5 animate-pulse rounded-full bg-cc-surface-raised" />
      </span>
    </div>
  );
}

function Resting({ data }: { data: Wheel }) {
  const { t } = useTranslation();
  const key = data.state === "ended" ? "ended" : data.state === "restricted" ? "restricted" : "resting";
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <img src="/nav-wheel.webp" alt="" className="h-[84px] w-[84px] object-contain opacity-80 drop-shadow-[0_8px_16px_rgba(0,0,0,.6)] grayscale-[35%]" />
      <div role="status" className="flex max-w-[420px] flex-col gap-2">
        <h2 className="m-0 text-[19px] font-extrabold text-[#ffd98a]">{t(`wheel.${key}.title`)}</h2>
        <p className="m-0 text-[14px] leading-[1.55] font-medium text-pretty text-cc-lavender">{t(`wheel.${key}.body`)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {key === "restricted" ? (
          <button type="button" className={QUIET_LINK} onClick={(e) => supportPanel.open(e.currentTarget)}>{t("wheel.contactSupport")}</button>
        ) : null}
        <Link to="/" className={cn(GOLD_CTA, "min-w-0 px-7 text-[15.5px] hover:text-[#2c1400]")}>{t("wheel.backHome")}</Link>
      </div>
    </div>
  );
}

type Phase = "idle" | "waiting" | "landing";

/** What the hub says and does (owner 2026-10-16: the hub IS the Spin — "Spin" while a spin is there, "Spun" after). */
type HubKind = "spin" | "signIn" | "spinning" | "spun" | "closed" | "locked" | "ended";

function hubKind(state: WheelState, spinning: boolean): HubKind {
  if (spinning) return "spinning";
  switch (state) {
    case "ready": return "spin";
    case "signInRequired": return "signIn";
    case "spunToday": return "spun";
    case "nothingToWin": return "locked";
    case "ended": return "ended";
    default: return "closed"; // closedToday (unavailable / restricted never show the wheel)
  }
}

/**
 * The wheel's hub as a real button over the centre (it does not turn with the wheel): gold and pulsing when a spin is
 * there, the wheel's purple with gold words when not — disabled, and named for what it means ("Spun", "Closed"…).
 * It scales with the wheel (a size container), never under 44px, and its words fit a 320px phone and a phone on its
 * side. While the wheel turns it stays focused but inert (aria-disabled) so a keyboard user keeps their place.
 */
function Hub({ kind, onSpin, hubRef }: { kind: HubKind; onSpin: () => void; hubRef: React.Ref<HTMLButtonElement> }) {
  const { t } = useTranslation();
  const live = kind === "spin" || kind === "signIn";
  const label =
    kind === "spin" ? t("wheel.spinLabel")
      : kind === "signIn" ? t("wheel.signInToSpinLabel")
        : kind === "spinning" ? t("wheel.spinning")
          : t(`wheel.hub.${kind}Label`);
  return (
    <button
      ref={hubRef}
      type="button"
      data-testid="wheel-hub"
      data-kind={kind}
      onClick={live ? onSpin : undefined}
      disabled={!live && kind !== "spinning"}
      aria-disabled={kind === "spinning" || undefined}
      aria-busy={kind === "spinning" || undefined}
      aria-label={label}
      className={cn(
        "absolute top-1/2 left-1/2 z-[3] flex aspect-square w-[31%] min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-cc-gold p-[3px] text-center text-[clamp(11px,6.3cqw,17px)] leading-[1.02] font-extrabold tracking-[-0.3px] text-balance shadow-[0_4px_14px_rgba(0,0,0,.6)] [overflow-wrap:anywhere]",
        "focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-white",
        live || kind === "spinning"
          ? "bg-[image:var(--cc-gold-cta)] text-[#2c1400] transition-[filter,scale] hover:brightness-105 active:scale-95"
          : "cursor-default bg-[#2c1050] text-[#ffd98a]",
      )}
    >
      {live ? <span aria-hidden className="pointer-events-none absolute -inset-[3px] animate-cc-ring rounded-full border-2 border-cc-gold" /> : null}
      {kind === "spinning" ? <Spinner className="h-[38%] w-[38%] border-[3px]" /> : <span aria-hidden>{t(`wheel.hub.${kind === "signIn" ? "spin" : kind}`)}</span>}
    </button>
  );
}

/** The wheel itself with the Spin in its hub, and whatever today holds: the prize, the countdown, or why there is nothing to spin. */
function WheelPlay({ data }: { data: Wheel }) {
  const { t } = useTranslation();
  const spinner = useSpinWheel();
  const refresh = useRefreshWheel();
  const motion = useWheelMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<WheelSpin | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the prize whose game the player has tried to pick: its card stays up (with the outcome) after the wheel is re-read
  const [actedOn, setActedOn] = useState<string | null>(null);
  const busy = useRef(false);
  const landed = useRef<string | null>(null);
  const placedFor = useRef<number | null>(null);
  // a tap whose answer never came keeps its id, so tapping again replays that spin instead of spending another
  const unanswered = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLButtonElement>(null);

  const segments = data.segments;
  const n = segments.length;
  const today = data.todaySpin ?? null;
  // this visit's spin, until the wheel re-read has it too (then bonus's latest word on it: e.g. credited on a game)
  const shown = result && today?.spinId !== result.spinId ? result : today;
  const extra = data.extraSpins;

  // Where the wheel rests when nothing is spinning: on today's latest slice (a reload after a spin), else on slice 0.
  // Never under a spin in flight, and never back onto a slice it has just animated to (the refetch after a spin).
  useLayoutEffect(() => {
    if (busy.current || n === 0) return;
    if (today ? landed.current === today.spinId && placedFor.current === n : placedFor.current === n) return;
    motion.rest(today ? Math.max(0, indexOfSpin(segments, today)) : 0, n);
    placedFor.current = n;
    landed.current = today?.spinId ?? null;
  }, [today, segments, n, motion]);

  const spinning = phase !== "idle";
  const ready = data.state === "ready";
  // the countdown to the next free daily spin: the main thing once today is used up; secondary while extra spins remain
  const dailyUsed = data.state === "closedToday" || data.state === "spunToday" || !!shown;
  const countdownTarget = dailyUsed ? instant(data.nextSpinAt) ?? instant(shown?.nextSpinAt) : null;
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
    const requestId = unanswered.current ?? newSpinRequestId();
    unanswered.current = requestId;
    try {
      const s = await spinner.mutateAsync({ requestId });
      unanswered.current = null;
      const index = indexOfSpin(segments, s);
      if (s.replayed || index < 0) {
        // this tap's spin already existed (a retry after a lost answer, another tab): no show, just where it landed
        motion.rest(Math.max(0, index), n);
      } else {
        setPhase("landing");
        await motion.land(index, n);
      }
      landed.current = s.spinId;
      placedFor.current = n;
      setResult(s);
      const focused = document.activeElement;
      if (!focused || focused === document.body || focused === hubRef.current) resultRef.current?.focus();
    } catch (e) {
      motion.coast();
      const err = toApiError(e);
      // a refusal is final for this tap; a lost answer (network, 5xx) keeps its id for the next tap
      if (err.status > 0 && err.status < 500) unanswered.current = null;
      if (err.errorCode === "WHEEL_NOT_AVAILABLE") setError(t("wheel.error.notAvailable"));
      else if (err.errorCode !== "PLAYER_RESTRICTED") setError(t("wheel.error.generic"));
    } finally {
      busy.current = false;
      setPhase("idle");
      void refresh();
    }
  }

  const ineligible = segments.some((s) => !s.eligible);
  const choosing = !!shown && shown.prizeType === "freeSpins" && (shown.outcome === "awaitingGame" || actedOn === shown.spinId);

  let message: ReactNode = null;
  if (spinning) message = <Line>{t("wheel.message.spinning")}</Line>;
  else if (shown) message = <Result copy={resultCopy(t, shown)} spin={shown} brief={actedOn === shown.spinId} more={ready && extra > 0} />;
  else if (ready) message = <Line>{t("wheel.message.ready")}</Line>;
  else if (data.state === "signInRequired") message = <Line>{t("wheel.message.guest")}</Line>;
  else if (data.state === "closedToday") message = <StateCopy title={t("wheel.closed.title")} body={t("wheel.closed.body")} />;
  else if (data.state === "nothingToWin") message = <StateCopy title={t("wheel.nothingToWin.title")} body={t("wheel.nothingToWin.body")} />;
  else if (data.state === "spunToday") message = <Line>{t("wheel.result.comeBack")}</Line>;

  // with extra spins left the hub is ready again and the daily countdown is only a footnote
  const countdown = remaining !== null && !spinning && dailyUsed ? (ready ? "secondary" : "main") : null;

  return (
    <div className="flex w-full flex-col items-center gap-[18px] short:flex-row short:items-center short:justify-center short:gap-8">
      {n > 0 ? (
        <div className="relative flex flex-none flex-col items-center">
          <WheelGraphic segments={segments} currency={data.currency} rotorRef={motion.rotor}
            hub={<Hub kind={hubKind(data.state, spinning)} onSpin={() => void spin()} hubRef={hubRef} />} />
          {extra > 0 && data.state !== "signInRequired" ? (
            <p data-testid="wheel-extra" className="relative z-[3] -mt-[14px] mb-0 inline-flex items-center rounded-full border border-[rgba(44,20,0,.35)] bg-[image:var(--cc-gold-cta)] px-3 py-[5px] text-[12.5px] leading-none font-extrabold text-[#2c1400] shadow-[0_6px_16px_rgba(0,0,0,.45)]">
              {t("wheel.extraSpins", { count: extra })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex w-full max-w-[420px] min-w-0 flex-col items-center gap-4 text-center short:max-w-[380px] short:gap-3">
        <div ref={resultRef} tabIndex={-1} role="status" aria-live="polite" className="flex min-h-[22px] w-full scroll-mt-[96px] scroll-mb-[100px] flex-col items-center outline-none">
          {message}
        </div>

        {error ? <Notice tone="info" role="alert" className="w-full text-left">{error}</Notice> : null}

        {choosing && shown && !spinning ? <ChoiceCard key={shown.spinId} spin={shown} timeZone={data.timeZone} onAct={setActedOn} /> : null}

        {countdown === "main" ? (
          <div className="flex flex-col items-center gap-1 rounded-cc-lg border border-[rgba(255,201,60,.28)] bg-[rgba(255,201,60,.06)] px-5 py-3 short:py-2">
            <span className="text-[12px] font-bold tracking-[.6px] text-cc-lavender uppercase">{t(shown || data.state === "spunToday" ? "wheel.nextSpin" : "wheel.opensIn")}</span>
            <span role="timer" className="tabular text-[28px] leading-[1.1] font-extrabold tracking-[.5px] text-cc-gold short:text-[24px]">{formatCountdown(remaining!)}</span>
          </div>
        ) : countdown === "secondary" ? (
          <p className="m-0 text-[12.5px] leading-[1.5] font-semibold text-cc-lavender">
            {t("wheel.nextDailySpin")} <span role="timer" className="tabular font-extrabold text-cc-gold">{formatCountdown(remaining!)}</span>
          </p>
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

/**
 * The spin's result, announced (it sits in the page's live region). Free spins credited on a game name it, with Play
 * now. `brief` = only the headline: the choice card under it is telling the rest (the player has just picked a game).
 * `more` = extra spins remain, so a miss is not "come back tomorrow".
 */
function Result({ copy, spin, brief = false, more = false }: { copy: ResultCopy; spin: WheelSpin; brief?: boolean; more?: boolean }) {
  const { t } = useTranslation();
  const gameId = !brief && copy.tone === "win" && spin.prizeType === "freeSpins" && spin.outcome === "granted" ? spinGameId(spin) : null;
  const game = useGame(gameId ?? "", !!gameId);
  const name = gameId ? game.data?.name ?? null : null;
  return (
    <div data-testid="wheel-result" className={cn("flex w-full animate-cc-rise flex-col items-center gap-2 rounded-cc-xl border px-4 py-4 short:gap-1 short:py-3", TONES[copy.tone])}>
      {spin.source === "granted" ? <span className="text-[11px] font-extrabold tracking-[1.1px] text-cc-lavender uppercase">{t("wheel.result.extraSpin")}</span> : null}
      <h2 className={cn("m-0 text-[21px] leading-[1.25] font-extrabold tracking-[-0.3px] text-pretty", copy.tone === "none" ? "text-cc-ink" : "text-cc-gold")}>{copy.headline}</h2>
      {brief ? null : <p className="m-0 text-[13.5px] leading-[1.55] font-medium text-pretty text-cc-text">{name ? t("wheel.result.spinsOn", { game: name }) : copy.tone === "none" && more ? t("wheel.result.noPrizeMore") : copy.body}</p>}
      {brief ? null : name && gameId ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <PlayNow gameId={gameId} name={name} />
          <Link to="/account" search={{ tab: "bonuses" }} className={QUIET_LINK}>{t("wheel.viewBonuses")}</Link>
        </div>
      ) : copy.link === "bonuses" ? (
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
