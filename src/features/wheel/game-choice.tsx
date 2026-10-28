import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/problem";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { gameQueryOptions, useGame, type GameDetail } from "@/features/lobby/api";
import { GameArt } from "@/features/lobby/game-art";
import { supportPanel } from "@/features/support/support-store";
import { gameSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { spinGameId, useChooseWheelGame, type Wheel, type WheelSpin } from "./api";
import { formatDay, formatInstant } from "./copy";
import { GOLD_LINK, QUIET_LINK } from "./styles";

/**
 * Owner 2026-10-16: a free-spins prize set up on several games waits ("awaitingGame") until the player picks ONE of
 * them; only then are its spins credited, all on that game. This is the picker: the prize, the deadline, the games
 * (each read from the lobby, shown as it arrives), a confirmation (the pick is final), then "N free spins on {game}"
 * with Play now. Bonus has the last word on everything: the window closing, a pick made elsewhere, a frozen account.
 * Owner 2026-10-28: free spins land before any real-money game (core registers the player with the provider itself), so
 * the card no longer announces a play-first rule; bonus's GAME_LAUNCH_REQUIRED stays handled as a refusal that keeps the
 * prize, in case an older holding still answers it.
 */

/** What went wrong with a pick. `expired`, `conflict` and `gone` end the choice; the others leave the list up. */
type Problem = "expired" | "conflict" | "gone" | "restricted" | "launchRequired" | "invalid" | "generic";

function problemOf(e: unknown): Problem {
  const { errorCode, status } = toApiError(e);
  if (errorCode === "WHEEL_NOT_AVAILABLE") return "expired";
  if (errorCode === "GAME_LAUNCH_REQUIRED") return "launchRequired"; // a 409 that keeps the prize: before the CONFLICT rule
  if (errorCode === "PLAYER_RESTRICTED") return "restricted";
  if (errorCode === "VALIDATION_FAILED" || status === 400) return "invalid";
  if (errorCode === "NOT_FOUND" || status === 404) return "gone";
  if (errorCode === "CONFLICT" || status === 409) return "conflict";
  return "generic";
}

const CARD = "flex w-full flex-col gap-3 rounded-cc-xl border border-[rgba(255,201,60,.4)] bg-[linear-gradient(180deg,rgba(44,16,80,.92)_0%,rgba(21,7,38,.92)_100%)] px-3 py-4 min-[400px]:px-4 text-left shadow-[0_12px_30px_rgba(6,3,11,.45)]";

/**
 * One prize's choice. `onAct` tells the parent a pick was attempted, so it keeps this card on screen after the wheel
 * is re-read (the prize then leaves `pendingChoices`) and the player still sees the outcome. `wonOn` adds the day the
 * prize was won (prizes from earlier days).
 */
export function ChoiceCard({ spin, timeZone, onAct, wonOn = false, className }: {
  spin: WheelSpin;
  timeZone: string | null | undefined;
  onAct?: (spinId: string) => void;
  wonOn?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const chooser = useChooseWheelGame();
  const [answer, setAnswer] = useState<WheelSpin | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [confirming, setConfirming] = useState<GameDetail | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const count = spin.freeSpinsCount ?? 0;
  const prize = t("wheel.prize.freeSpins", { count });
  // one game: nothing to choose — the prize is claimed with its one game
  const single = (spin.freeSpinGameIds ?? []).length === 1;

  async function choose(game: GameDetail) {
    onAct?.(spin.spinId);
    setProblem(null);
    try {
      setAnswer(await chooser.mutateAsync({ spinId: spin.spinId, gameId: game.id }));
    } catch (e) {
      setProblem(problemOf(e));
    } finally {
      setConfirming(null);
      // the dialog hands focus back to the row it opened from, which may be gone now: the outcome takes it
      window.setTimeout(() => statusRef.current?.focus(), 0);
    }
  }

  // What the card shows: bonus's answer to this player's pick; else a refusal that ends the choice (time up, prize
  // gone); else what the wheel now says about the prize (re-read after a pick — or a pick made in another tab, which
  // is also what a 409 CONFLICT means: today's prize then comes back credited on the game picked there).
  let settled: WheelSpin | null = null;
  let final: Problem | null = null;
  if (answer) settled = answer;
  else if (problem === "expired" || problem === "gone") final = problem;
  else if (spin.outcome !== "awaitingGame") settled = spin;
  else if (problem === "conflict") final = problem;
  const choosing = !settled && !final;

  let status: React.ReactNode = null;
  if (settled?.outcome === "granted") status = <Credited spin={settled} />;
  else if (settled?.outcome === "pending") status = <Outcome title={t("wheel.result.wonSpins", { count: settled.freeSpinsCount ?? 0 })} body={t("wheel.result.pendingBody")} />;
  else if (settled) {
    status = (
      <Outcome title={t("wheel.choice.failedTitle")} body={t("wheel.result.failedBody")}>
        <button type="button" className={QUIET_LINK} onClick={(e) => supportPanel.open(e.currentTarget)}>{t("wheel.contactSupport")}</button>
      </Outcome>
    );
  } else if (final) {
    status = (
      <Outcome title={t(`wheel.choice.${final}Title`)} body={t(`wheel.choice.${final}Body`)}>
        {final === "conflict" ? <Link to="/account" search={{ tab: "bonuses" }} className={QUIET_LINK}>{t("wheel.viewBonuses")}</Link> : null}
      </Outcome>
    );
  } else if (problem === "launchRequired") {
    status = (
      <Notice tone="info" role="none" className="w-full">
        <span className="flex flex-col items-start gap-2">
          <span>{t("wheel.choice.launchRequired")}</span>
          <Link to="/games" className={cn(QUIET_LINK, "min-h-10 px-3 text-[13px]")}>{t("wheel.choice.browseGames")}</Link>
        </span>
      </Notice>
    );
  } else if (problem) {
    status = (
      <Notice tone={problem === "restricted" ? "info" : "error"} role="none" className="w-full">
        <span className="flex flex-col items-start gap-2">
          <span>{t(`wheel.choice.${problem}`)}</span>
          {problem === "restricted" ? (
            <button type="button" className={cn(QUIET_LINK, "min-h-10 px-3 text-[13px]")} onClick={(e) => supportPanel.open(e.currentTarget)}>{t("wheel.contactSupport")}</button>
          ) : null}
        </span>
      </Notice>
    );
  }

  const deadline = formatInstant(spin.chooseBy, i18n.language, timeZone);
  const day = wonOn ? formatDay(spin.spinDay, i18n.language) : null;

  return (
    <section aria-labelledby={titleId} data-testid="wheel-choice" data-spin={spin.spinId} className={cn(CARD, className)}>
      {choosing ? (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-cc-gold uppercase">{t(single ? "wheel.choice.eyebrowSingle" : "wheel.choice.eyebrow")}</span>
          <h3 id={titleId} className="m-0 text-[19px] leading-[1.25] font-extrabold tracking-[-0.3px] text-cc-ink">{prize}</h3>
          <p className="m-0 flex flex-wrap gap-x-3 gap-y-[2px] text-[12.5px] leading-[1.5] font-semibold text-cc-lavender">
            {day ? <span>{t("wheel.choice.wonOn", { date: day })}</span> : null}
            {deadline ? <span className="text-[#ffd98a]">{t("wheel.choice.chooseBy", { date: deadline })}</span> : null}
          </p>
          <p className="m-0 text-[13px] leading-[1.5] font-medium text-pretty text-cc-text">{t(single ? "wheel.choice.introSingle" : "wheel.choice.intro")}</p>
        </div>
      ) : (
        <h3 id={titleId} className="sr-only">{prize}</h3>
      )}

      <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="flex scroll-mt-[96px] scroll-mb-[100px] flex-col outline-none empty:hidden">
        {status}
      </div>

      {choosing ? <GameList ids={spin.freeSpinGameIds ?? []} disabled={chooser.isPending} onPick={setConfirming} pickLabel={t(single ? "wheel.choice.claim" : "wheel.choice.pick")} /> : null}

      <Dialog
        open={!!confirming}
        onOpenChange={(open) => { if (!open && !chooser.isPending) setConfirming(null); }}
        eyebrow={t("wheel.choice.eyebrow")}
        title={t("wheel.choice.confirmTitle", { game: confirming?.name ?? "" })}
        description={t("wheel.choice.confirmBody", { count, game: confirming?.name ?? "" })}
        width={420}
      >
        {confirming ? (
          <div className="flex items-center gap-3 rounded-cc-lg border border-cc-line bg-white/[.03] p-2">
            <span className="h-14 w-14 flex-none overflow-hidden rounded-cc"><GameArt name={confirming.name} src={confirming.thumbnailUrl ?? confirming.logoUrl} /></span>
            <span className="flex min-w-0 flex-col">
              <span className="line-clamp-2 text-[15px] font-extrabold text-cc-ink">{confirming.name}</span>
              <span className="truncate text-[12.5px] font-semibold text-cc-lavender">{confirming.providerName}</span>
            </span>
          </div>
        ) : null}
        <div className="mt-1 flex flex-col gap-[10px]">
          <Button variant="primary" size="lg" loading={chooser.isPending} onClick={() => confirming && void choose(confirming)}>{t("wheel.choice.confirm")}</Button>
          <Button variant="secondary" size="lg" disabled={chooser.isPending} onClick={() => setConfirming(null)}>{t("wheel.choice.back")}</Button>
        </div>
      </Dialog>
    </section>
  );
}

/** The prize's games, each read from the lobby and shown as it arrives; one that cannot be read is left out. */
function GameList({ ids, disabled, onPick, pickLabel }: { ids: string[]; disabled: boolean; onPick: (game: GameDetail) => void; pickLabel: string }) {
  const { t, i18n } = useTranslation();
  const games = useQueries({ queries: ids.map((id) => gameQueryOptions(i18n.language, id)) });
  const loading = games.some((g) => g.isPending);
  const failed = games.length > 0 && games.every((g) => g.isError);

  if (failed || ids.length === 0) {
    return (
      <Notice tone="error" className="w-full">
        <span className="flex flex-col items-start gap-2">
          <span>{t("wheel.choice.noGames")}</span>
          {ids.length > 0 ? (
            <button type="button" className={cn(QUIET_LINK, "min-h-10 px-3 text-[13px]")} onClick={() => games.forEach((g) => void g.refetch())}>{t("wheel.retry")}</button>
          ) : null}
        </span>
      </Notice>
    );
  }

  return (
    <ul aria-label={t("wheel.choice.listLabel")} aria-busy={loading || undefined} className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-2 p-0">
      {games.map((g, i) => {
        if (g.isPending) {
          return (
            <li key={ids[i]} aria-hidden className="flex min-h-[64px] items-center gap-3 rounded-cc-lg border border-cc-line bg-white/[.02] p-2">
              <span className="h-12 w-12 flex-none animate-pulse rounded-cc bg-cc-surface-raised" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-3 w-3/4 animate-pulse rounded-full bg-cc-surface-raised" />
                <span className="h-[10px] w-1/2 animate-pulse rounded-full bg-cc-surface-raised" />
              </span>
            </li>
          );
        }
        const game = g.data;
        if (!game) return null; // could not be read: skipped, the others still offered
        return (
          <li key={ids[i]}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(game)}
              className="group flex min-h-[64px] w-full items-center gap-[10px] rounded-cc-lg border border-cc-line bg-white/[.03] p-2 pr-[10px] text-left transition-[background-color,border-color] hover:border-[rgba(255,201,60,.55)] hover:bg-[rgba(255,201,60,.07)] disabled:opacity-60"
            >
              <span className="h-11 w-11 flex-none overflow-hidden rounded-cc bg-cc-surface-raised min-[400px]:h-12 min-[400px]:w-12"><GameArt name={game.name} src={game.thumbnailUrl ?? game.logoUrl} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="line-clamp-2 text-[14px] leading-[1.25] font-extrabold break-words text-cc-ink min-[400px]:text-[14.5px]">{game.name}</span>
                <span className="truncate text-[12px] font-semibold text-cc-lavender">{game.providerName}</span>
              </span>
              <span aria-hidden className="hidden flex-none rounded-full border border-[rgba(255,201,60,.5)] px-3 py-[6px] text-[12px] font-extrabold text-cc-gold group-hover:bg-[rgba(255,201,60,.12)] min-[400px]:inline-flex">{pickLabel}</span>
              {/* a narrow phone keeps the room for the game's name: a chevron instead of the word */}
              <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[rgba(255,201,60,.5)] text-[17px] leading-none font-extrabold text-cc-gold min-[400px]:hidden">›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Outcome({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <h4 className="m-0 text-[17px] leading-[1.3] font-extrabold text-[#ffd98a]">{title}</h4>
      <p className="m-0 text-[13.5px] leading-[1.55] font-medium text-pretty text-cc-text">{body}</p>
      {children ? <div className="mt-1 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

/** "10 free spins on Sweet Bonanza" with Play now — the prize once it is on its game. */
function Credited({ spin }: { spin: WheelSpin }) {
  const { t } = useTranslation();
  const gameId = spinGameId(spin);
  const game = useGame(gameId ?? "", !!gameId);
  const name = game.data?.name ?? null;
  const count = spin.freeSpinsCount ?? 0;
  return (
    <Outcome
      title={name ? t("wheel.choice.doneTitle", { count, game: name }) : t("wheel.result.wonSpins", { count })}
      body={t(name ? "wheel.choice.doneBody" : "wheel.result.spinsBody")}
    >
      {gameId && name ? <PlayNow gameId={gameId} name={name} /> : null}
      <Link to="/account" search={{ tab: "bonuses" }} className={QUIET_LINK}>{t("wheel.viewBonuses")}</Link>
    </Outcome>
  );
}

/** The game's page (`/games/$id/{-$slug}`), as My bonuses links it. */
export function PlayNow({ gameId, name, className }: { gameId: string; name: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Link to="/games/$id/{-$slug}" params={{ id: gameId, slug: gameSlug(name) }} aria-label={t("wheel.playNowLabel", { game: name })} className={cn(GOLD_LINK, className)}>
      {t("wheel.playNow")}
    </Link>
  );
}

/**
 * The player's free-spins prizes still waiting for a game, from any day (bonus answers them even while the wheel is
 * off). `exclude` = the prize the wheel itself is showing (today's), so it is not offered twice. A prize the player
 * has just acted on stays here after the wheel is re-read (it has left the list by then) so its outcome stays visible.
 */
export function PendingChoices({ data, exclude }: { data: Wheel; exclude?: string | null }) {
  const { t } = useTranslation();
  const [acted, setActed] = useState<Record<string, WheelSpin>>({});
  const pending = data.pendingChoices.filter((s) => s.spinId !== exclude);
  const kept = Object.values(acted).filter((a) => a.spinId !== exclude && !pending.some((p) => p.spinId === a.spinId));
  const items = [...pending, ...kept];
  const titleId = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="m-0 text-[19px] leading-[1.25] font-extrabold tracking-[-0.3px] text-cc-ink">{t("wheel.pending.title")}</h2>
        <p className="m-0 text-[13px] leading-[1.5] font-medium text-pretty text-cc-lavender">{t("wheel.pending.intro")}</p>
      </div>
      {items.map((s) => (
        <ChoiceCard key={s.spinId} spin={s} timeZone={data.timeZone} wonOn onAct={() => setActed((a) => ({ ...a, [s.spinId]: s }))} />
      ))}
    </section>
  );
}
