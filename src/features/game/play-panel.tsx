import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, Spinner } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { useSession } from "@/features/auth/session";
import type { GameDetail } from "@/features/lobby/api";
import { GameContainer } from "./game-container";
import { LAUNCH_ERRORS, useLaunch, useLaunchEligibility, type Launch, type Mode } from "./launch";

/** Set when the guest leaves for sign-in from this game; `?play=` opens the game only when it matches. */
const RETURN_KEY = "chocho:playAfterSignIn";
function setReturnMarker(gameId: string, mode: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, `${gameId}:${mode}`);
  } catch {
    // no storage: the player presses Play again after signing in
  }
}
function consumeReturnMarker(gameId: string, mode: string) {
  try {
    const ok = sessionStorage.getItem(RETURN_KEY) === `${gameId}:${mode}`;
    sessionStorage.removeItem(RETURN_KEY);
    return ok;
  } catch {
    return false;
  }
}

type Status =
  | { kind: "idle" }
  | { kind: "launching"; mode: Mode }
  | { kind: "error"; mode: Mode; withBonus: boolean; code: string }
  | { kind: "cancelled"; mode: Mode };

/**
 * Design (Sweet Bonanza — "Choose your play mode"): Play for Fun (only when `hasDemo`) and Play for Real. A guest is
 * asked to sign in ("Sign in to continue") and comes back to this game with the mode chosen, which then opens — core's
 * launch needs a signed-in player for demo as well, so both modes ask. Real money with an eligible bonus asks first
 * whether to play with the bonus balance (the prompt the design does not have — P3-16: built from bonus's
 * launch-eligibility). Launching shows the design's spinner labels; a refusal lands in the notice slot with Retry,
 * keeping the chosen mode. A launch opens the game container.
 */
export function PlayPanel({ game, autoPlay, onAutoPlayed }: { game: GameDetail; autoPlay?: "demo" | "real"; onAutoPlayed: () => void }) {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const launch = useLaunch(game.id);
  const eligibility = useLaunchEligibility(game.id);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [playing, setPlaying] = useState<Launch | null>(null);
  const [signInFor, setSignInFor] = useState<Mode | null>(null);
  const [bonusPrompt, setBonusPrompt] = useState(false);
  const autoPlayed = useRef(false);
  const closeGame = useCallback(() => setPlaying(null), []);

  const start = (mode: Mode, withBonus: boolean) => {
    setStatus({ kind: "launching", mode });
    launch.mutate({ mode, withBonus }, {
      onSuccess: (answer) => {
        setStatus({ kind: "idle" });
        setPlaying(answer);
      },
      onError: (e) => setStatus({ kind: "error", mode, withBonus, code: e.errorCode }),
    });
  };

  const choose = (mode: Mode) => {
    if (!signedIn) {
      setSignInFor(mode);
      return;
    }

    // Real money asks about the bonus whenever bonus says it applies — and also when bonus could not be asked
    // (review S6): an unanswered eligibility must not silently turn into a cash-funded session.
    if (mode === "Real" && (eligibility.data?.isGameEligible || eligibility.isError)) {
      setBonusPrompt(true);
      return;
    }

    start(mode, false);
  };

  // Back from the sign-in the guest was sent to: open the mode they chose, once — and only when OUR flow sent them
  // (the marker set on "Continue to Sign in"), so a crafted `?play=real` link cannot open a real-money session.
  useEffect(() => {
    if (!autoPlay || !signedIn || autoPlayed.current || eligibility.isPending) return;
    autoPlayed.current = true;
    onAutoPlayed();
    // after this render: the launch sets state, which an effect body must not do synchronously
    if (consumeReturnMarker(game.id, autoPlay)) queueMicrotask(() => choose(autoPlay === "real" ? "Real" : "Demo"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when sign-in and eligibility settle
  }, [autoPlay, signedIn, eligibility.isPending]);

  const launching = status.kind === "launching";
  const modeLabel = (mode: Mode) => t(mode === "Demo" ? "game.modeNameDemo" : "game.modeNameReal");
  const errorKey = (code: string) => (LAUNCH_ERRORS as readonly string[]).includes(code) ? `game.launchError.${code}` : "game.launchError.UNKNOWN";

  return (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-[12.5px] font-bold tracking-[1px] text-cc-label uppercase">{t("game.playMode")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Button size="lg" disabled={!game.hasDemo || launching} onClick={() => choose("Demo")}
            className="h-[50px] rounded-[13px] border-[rgba(167,139,250,.45)] bg-[linear-gradient(180deg,#2b1350,#1c0b33)] text-[#efe6ff] disabled:border-[rgba(167,139,250,.22)] md:h-14 md:rounded-cc-lg">
            {status.kind === "launching" && status.mode === "Demo" ? <><Spinner className="text-[#c4b5fd]" /> {t("game.startingDemo")}</> : t("game.playFun")}
          </Button>
          <span className="text-center text-[12px] text-cc-muted">{t("game.virtualCredits")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <Button variant="primary" size="lg" disabled={launching || (signedIn && eligibility.isPending)} onClick={() => choose("Real")} className="h-[50px] rounded-[13px] md:h-14 md:rounded-cc-lg">
            {status.kind === "launching" && status.mode === "Real" ? <><Spinner className="text-[#2c1400]" /> {t("game.openingGame")}</> : t("game.playReal")}
          </Button>
          <span className="text-center text-[12px] text-cc-muted">{t("game.realMoney")}</span>
        </div>
      </div>

      {!game.hasDemo ? <Notice tone="info">{t("game.noDemo")}</Notice> : null}
      {!signedIn ? <Notice tone="info">{t("game.signInRequired")}</Notice> : null}
      {status.kind === "cancelled" ? <Notice tone="info">{t(status.mode === "Demo" ? "game.signInCancelledDemo" : "game.signInCancelled", { name: game.name })}</Notice> : null}
      {status.kind === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-cc-md border border-[rgba(255,93,125,.4)] bg-[rgba(255,93,125,.1)] px-[14px] py-3 text-[13px] font-semibold text-[#ffb3c2]">
          <span className="min-w-0 flex-1">{t(errorKey(status.code), { mode: modeLabel(status.mode) })}</span>
          {status.code === "CURRENCY_NOT_HELD" ? (
            <Link to="/wallet" hash="deposit" className="flex h-8 items-center rounded-[9px] border border-[rgba(255,201,60,.45)] bg-[rgba(255,201,60,.12)] px-3 text-[12.5px] font-bold text-[#ffd98a]">{t("wallet.deposit")}</Link>
          ) : status.code === "BONUS_NOT_ELIGIBLE" ? (
            <button type="button" onClick={() => start(status.mode, false)} className="h-8 rounded-[9px] border border-[rgba(255,201,60,.45)] bg-[rgba(255,201,60,.12)] px-3 text-[12.5px] font-bold text-[#ffd98a]">{t("game.playWithCash")}</button>
          ) : (
            <button type="button" onClick={() => start(status.mode, status.withBonus)} className="h-8 rounded-[9px] border border-[rgba(255,201,60,.45)] bg-[rgba(255,201,60,.12)] px-3 text-[12.5px] font-bold text-[#ffd98a]">{t("common.retry")}</button>
          )}
        </div>
      ) : null}

      <Dialog open={signInFor !== null} onOpenChange={(open) => { if (!open) { setStatus({ kind: "cancelled", mode: signInFor ?? "Real" }); setSignInFor(null); } }}
        title={t("game.signInTitle")} description={t(signInFor === "Demo" ? "game.signInBodyDemo" : "game.signInBodyReal", { name: game.name })} width={400}>
        <Button variant="primary" size="lg" onClick={() => {
          const mode = signInFor === "Demo" ? "demo" : "real";
          setSignInFor(null);
          setReturnMarker(game.id, mode);
          authDialog.open("signin", `/games/${game.id}?play=${mode}`);
        }}>{t("game.continueToSignIn")}</Button>
        <Button variant="secondary" size="lg" onClick={() => { setStatus({ kind: "cancelled", mode: signInFor ?? "Real" }); setSignInFor(null); }}>{t("cancel")}</Button>
      </Dialog>

      <Dialog open={bonusPrompt} onOpenChange={setBonusPrompt} title={t("game.bonusPromptTitle")}
        description={eligibility.isError ? t("game.bonusPromptUnknown") : t("game.bonusPromptBody", { bonus: eligibility.data?.bonusName ?? t("game.yourBonus") })} width={420}>
        <Button variant="primary" size="lg" onClick={() => { setBonusPrompt(false); start("Real", true); }}>{t("game.useBonus")}</Button>
        <Button variant="secondary" size="lg" onClick={() => { setBonusPrompt(false); start("Real", false); }}>{t("game.useCash")}</Button>
      </Dialog>

      {playing ? <GameContainer launch={playing} gameName={game.name} onClose={closeGame} /> : null}
    </div>
  );
}
