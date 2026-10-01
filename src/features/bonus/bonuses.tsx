import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/problem";
import { MASKED, peso } from "@/lib/money";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useGame } from "@/features/lobby/api";
import { useBalance, useBalanceHidden } from "@/features/wallet/balance-store";
import { SupportButton } from "@/features/support/support-button";
import {
  bonusQueries, isAwaiting, sections, useBonusData, useClaimBonus, useClaimSpins, type ClaimableFreeBet, type PlayerFreeBet,
} from "./api";
import {
  awaitingCopy, bonusConditions, bonusReward, bonusTerms, heldSpinsCopy, runningCopy, spinsOfferTerms, spinsReward, when,
  type Progress,
} from "./copy";

type Tone = "ok" | "warn" | "error";
interface Message { tone: Tone; text: string; final?: boolean }

/**
 * Design (ChoCho Bonuses): the ONE bonuses component, used by the header's in-place drawer (`panel`: one column, no
 * heading) and My Account → Bonuses (`page`). Bonus balance with the shared Hide setting; Available to claim (bonus's
 * claimable definitions in the skin's currency + claimable free-rounds campaigns); Active bonuses (running, awaiting
 * a deposit, free spins held). A claim never happens on the first press — it asks for the terms checkbox (never
 * preselected) first — and the card then shows what the service answered, nothing assumed locally.
 */
export function Bonuses({ variant }: { variant: "page" | "panel" }) {
  const { t } = useTranslation();
  const bonus = useBonusData();
  const balance = useBalance();
  const [hidden, setHidden] = useBalanceHidden();
  const qc = useQueryClient();
  const panel = variant === "panel";

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [claiming, setClaiming] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message | undefined>>({});
  const say = (key: string, message: Message | undefined) => setMessages((m) => ({ ...m, [key]: message }));
  const inFlight = useRef(false);
  const claimBonus = useClaimBonus();
  const claimSpins = useClaimSpins();

  // A grant, a conversion or a forfeit moves the bonus funds on the wallet, and core pushes that on the hub: re-read
  // bonus then (and only then — not on every bet), so a deposit that grants the claimed bonus turns it Active here.
  const live = balance.status === "live" ? balance.balance : null;
  const fundsKey = live ? `${live.activeBonusRef ?? ""}:${live.bonusCents > 0}` : null;
  const lastFunds = useRef(fundsKey);
  useEffect(() => {
    if (fundsKey === null || lastFunds.current === fundsKey) return;
    const first = lastFunds.current === null;
    lastFunds.current = fundsKey;
    if (!first) void qc.invalidateQueries({ queryKey: queryKeys.session.bonusAll() });
  }, [fundsKey, qc]);

  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  async function claim(key: string, run: () => Promise<{ key: string; text: string }>, stillOffered: () => Promise<{ key: string; text: string } | null>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setClaiming(key);
    try {
      const done = await run();
      setConfirming(null);
      setAccepted((a) => ({ ...a, [key]: false }));
      say(done.key, { tone: "ok", text: done.text });
    } catch (e) {
      const error = toApiError(e);
      const code = error.errorCode;
      if (error.status === 0 || (error.status >= 500 && code !== "FREE_ROUNDS_PROVIDER_FAILED")) {
        // The answer was lost, not a refusal: the claim may have landed. Say so, block a second press, and look.
        say(key, { tone: "warn", text: t("bonus.claimChecking") });
        const landed = await stillOffered().catch(() => null);
        if (landed) {
          setConfirming(null);
          say(key, undefined);
          say(landed.key, { tone: "ok", text: landed.text });
        } else {
          say(key, { tone: "error", text: t("bonus.claimError.UNKNOWN") });
        }
      } else {
        const final = code === "NOT_FOUND" || code === "BONUS_NOT_ELIGIBLE";
        const text = key.startsWith("spins:") && code === "BONUS_NOT_ELIGIBLE" ? t("bonus.claimError.spinsNotEligible") : t(`bonus.claimError.${code}`, { defaultValue: t("bonus.claimError.UNKNOWN") });
        if (final) setConfirming(null);
        say(key, { tone: "error", text, final });
      }
    } finally {
      inFlight.current = false;
      setClaiming(null);
    }
  }

  const startOrConfirm = (key: string, onConfirm: () => void) => {
    if (claiming) return;
    if (confirming !== key) {
      setConfirming(key);
      setOpen((o) => ({ ...o, [key]: true }));
      say(key, undefined);
      return;
    }
    if (accepted[key]) onConfirm();
  };

  const data = bonus.data;
  const s = data ? sections(data) : null;
  const definitions = new Map((data?.catalog ?? []).map((c) => [c.bonus.id, c.bonus]));
  const cols = panel ? "grid-cols-1" : "grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))]";

  const offerCards = s
    ? [
        ...s.offers.map((o) => {
          const key = `bonus:${o.bonus.id}`;
          return (
            <OfferCard key={key} id={key} name={o.bonus.name} reward={bonusReward(t, o.bonus)} deadline={when(o.bonus.endAt) ? t("bonus.claimBy", { date: when(o.bonus.endAt) }) : null}
              conditions={bonusConditions(t, o.bonus)} terms={bonusTerms(t, o.bonus)}
              state={{ open: !!open[key], confirming: confirming === key, accepted: !!accepted[key], claiming: claiming === key, message: messages[key] }}
              onTerms={() => toggle(key)} onAccept={(v) => setAccepted((a) => ({ ...a, [key]: v }))}
              onClaim={() => startOrConfirm(key, () => void claim(key,
                async () => {
                  await claimBonus.mutateAsync({ bonusId: o.bonus.id });
                  return { key, text: t("bonus.claimed.awaiting") };
                },
                async () => {
                  const rows = await qc.fetchQuery({ ...bonusQueries.active(), staleTime: 0 });
                  return rows.some((r) => r.bonusId === o.bonus.id && (isAwaiting(r) || r.status === "active")) ? { key, text: t("bonus.claimed.awaiting") } : null;
                }))} />
          );
        }),
        ...s.claimableSpins.map((c) => {
          const key = `spins:${c.freeBetId}`;
          return (
            <SpinsOfferCard key={key} id={key} offer={c}
              state={{ open: !!open[key], confirming: confirming === key, accepted: !!accepted[key], claiming: claiming === key, message: messages[key] }}
              onTerms={() => toggle(key)} onAccept={(v) => setAccepted((a) => ({ ...a, [key]: v }))}
              onClaim={() => startOrConfirm(key, () => void claim(key,
                async () => {
                  const held = await claimSpins.mutateAsync({ freeBetId: c.freeBetId });
                  return { key: `held:${held.playerFreeBetId}`, text: t(held.assigned ? "bonus.claimed.spins" : "bonus.claimed.spinsPending") };
                },
                async () => {
                  // Landed = a holding of this campaign that was not there before the press (review F5: a campaign with
                  // uses left may already be held once, and that one proves nothing about this claim).
                  const before = new Set((data?.freeBets ?? []).filter((r) => r.freeBetId === c.freeBetId).map((r) => r.playerFreeBetId));
                  const rows = await qc.fetchQuery({ ...bonusQueries.freeBets(), staleTime: 0 });
                  const held = rows.find((r) => r.freeBetId === c.freeBetId && !before.has(r.playerFreeBetId));
                  return held ? { key: `held:${held.playerFreeBetId}`, text: t("bonus.claimed.spinsPending") } : null;
                }))} />
          );
        }),
      ]
    : [];

  const activeCards = s
    ? [
        ...s.running.map((row) => {
          const definition = definitions.get(row.bonusId);
          if (isAwaiting(row)) {
            // Same key as the offer it came from, so the claim's answer lands here; a running instance has its own key,
            // so "added on your next deposit" does not follow the bonus once it is granted (review F6).
            const key = `bonus:${row.bonusId}`;
            // The engine grants only the running bonus's next step while one runs (review F8).
            const current = s.running.find((r) => r.status === "active" && r.bonusId !== row.bonusId);
            const c = awaitingCopy(t, definition, current?.bonusName ?? null);
            return <ActiveCard key={key} id={key} name={row.bonusName} reward={c.reward} status="awaiting" remaining={c.remaining} expiry={c.expiry} details={c.details}
              open={!!open[key]} onDetails={() => toggle(key)} message={messages[key]} />;
          }
          const key = `running:${row.playerBonusId ?? row.bonusId}`;
          const c = runningCopy(t, row, definition, live, hidden);
          return <ActiveCard key={key} id={key} name={row.bonusName} reward={c.reward} status="active" remaining={c.remaining} progress={c.progress} expiry={c.expiry} details={c.details}
            open={!!open[key]} onDetails={() => toggle(key)} message={messages[key]} />;
        }),
        ...s.spins.map((f) => {
          const key = `held:${f.playerFreeBetId}`;
          return <HeldSpinsCard key={key} id={key} holding={f} open={!!open[key]} onDetails={() => toggle(key)} message={messages[key]} />;
        }),
      ]
    : [];

  return (
    <div className="flex flex-col gap-[18px] text-cc-ink">
      {!panel ? (
        <div className="flex flex-col gap-[7px]">
          <h2 className="m-0 text-[22px] font-extrabold tracking-[-.4px]">{t("bonus.title")}</h2>
          <span className="text-[13.5px] leading-[1.5] font-medium text-[#a795c5]">{t("bonus.subtitle")}</span>
        </div>
      ) : null}

      <div className={cn(CARD, "flex-row flex-wrap items-center gap-x-4 gap-y-[10px] py-[14px]")}>
        <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-1">
          <span className="text-[10.5px] font-extrabold tracking-[1.1px] text-cc-muted uppercase">{t("bonus.balance")}</span>
          <span aria-live="polite" data-testid="bonus-balance" className="tabular text-[24px] font-extrabold tracking-[-.6px]">
            {!live ? "—" : hidden ? MASKED : peso(live.bonusCents)}
          </span>
        </span>
        <button type="button" aria-pressed={hidden} onClick={() => setHidden(!hidden)}
          className="h-9 flex-none rounded-[10px] border border-[rgba(167,139,250,.26)] bg-white/[.04] px-[13px] text-[12.5px] font-bold text-[#cbb6e6] hover:bg-[rgba(167,139,250,.16)] hover:text-cc-ink">
          {t(hidden ? "bonus.show" : "bonus.hide")}
        </button>
      </div>

      {bonus.isPending ? (
        <div aria-busy="true" aria-label={t("bonus.loading")} className="flex flex-col gap-[10px]">
          {[0, 1, 2].map((k) => <span key={k} className="h-[108px] animate-pulse rounded-cc-lg border border-[rgba(167,139,250,.14)] bg-white/[.03]" />)}
        </div>
      ) : bonus.isError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-cc-lg border border-[rgba(248,113,113,.4)] bg-[rgba(248,113,113,.08)] p-[18px]">
          <span className="text-[13.5px] leading-[1.55] font-semibold text-[#fca5a5]">{t("bonus.loadFailed")}</span>
          <div className="flex flex-wrap gap-[9px]">
            <button type="button" onClick={() => void bonus.refetch()} className={cn(GOLD, "px-[18px]")}>{t("common.retry")}</button>
            <SupportButton className="flex min-h-11 items-center rounded-cc border border-[rgba(167,139,250,.32)] bg-white/[.04] px-[18px] text-[13.5px] font-bold text-cc-ink hover:bg-white/[.08]">{t("bonus.support")}</SupportButton>
          </div>
        </div>
      ) : s ? (
        <div className="flex flex-col gap-[22px]">
          <Section title={t("bonus.available")} count={offerCards.length} empty={t("bonus.availableEmpty")} cols={cols}>{offerCards}</Section>
          <Section title={t("bonus.active")} count={activeCards.length} empty={t("bonus.activeEmpty")} cols={cols}>{activeCards}</Section>
          <span className="text-[12px] leading-[1.55] font-medium text-cc-muted">{t("bonus.footnote")}</span>
        </div>
      ) : null}
    </div>
  );
}

const CARD = "flex flex-col gap-[10px] rounded-cc-lg border border-[rgba(167,139,250,.2)] bg-[linear-gradient(180deg,#23103f_0%,#180a2c_100%)] px-4 py-[15px]";
const GOLD = "min-h-11 rounded-cc bg-[image:var(--cc-gold-cta)] text-[13.5px] font-extrabold text-[#2c1400] shadow-[0_8px_20px_rgba(235,156,13,.28)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";
const OUTLINE = "min-h-11 whitespace-nowrap rounded-cc border border-[rgba(167,139,250,.3)] bg-white/[.04] px-[15px] text-[13px] font-bold text-[#e9e0f5] hover:border-[rgba(167,139,250,.6)] hover:text-cc-ink";

function Section({ title, count, empty, cols, children }: { title: string; count: number; empty: string; cols: string; children: ReactNode[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center gap-[10px]">
        <h3 className="m-0 text-[15px] font-extrabold tracking-[-.2px]">{title}</h3>
        <span className="inline-flex h-[22px] items-center rounded-full border border-[rgba(167,139,250,.3)] bg-[rgba(167,139,250,.12)] px-[9px] text-[11px] font-extrabold text-[#d8c8f2]">{count}</span>
      </div>
      {count === 0 ? (
        <span className="rounded-cc-md border border-dashed border-[rgba(167,139,250,.26)] p-4 text-[13.5px] font-semibold text-[#a795c5]">{empty}</span>
      ) : (
        <div className={cn("grid items-start gap-3", cols)}>{children}</div>
      )}
    </section>
  );
}

function Icon({ kind }: { kind: "gift" | "coins" }) {
  const d = kind === "gift"
    ? "M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7h18v4H3zM12 7v14M8 7a2 2 0 1 1 2-3c1.5 0 2 3 2 3M16 7a2 2 0 1 0-2-3c-1.5 0-2 3-2 3"
    : "M12 6c4 0 7 1.1 7 2.5S16 11 12 11s-7-1.1-7-2.5S8 6 12 6zM5 8.5v7c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5v-7";
  return (
    <span aria-hidden className={cn("flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] border",
      kind === "gift" ? "border-[rgba(255,201,60,.24)] bg-[rgba(255,201,60,.1)]" : "border-[rgba(167,139,250,.26)] bg-[rgba(167,139,250,.12)]")}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={kind === "gift" ? "#ffc93c" : "#c4b5fd"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  );
}

function Head({ icon, name, reward, chip, gold }: { icon: "gift" | "coins"; name: string; reward: string; chip: ReactNode; gold?: boolean }) {
  return (
    <div className="flex flex-wrap items-start gap-x-[10px] gap-y-2">
      <Icon kind={icon} />
      <span className="flex min-w-0 flex-[1_1_140px] flex-col gap-[3px]">
        <span className="text-[15px] font-extrabold text-pretty">{name}</span>
        {reward ? <span className={cn("text-[13.5px] font-semibold text-pretty", gold ? "text-[#ffd98a]" : "text-[#e6ddf5]")}>{reward}</span> : null}
      </span>
      {chip}
    </div>
  );
}

function Chip({ tone, children }: { tone: "ok" | "gold"; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 flex-none items-center rounded-full border px-[10px] text-[10px] font-extrabold tracking-[.6px] whitespace-nowrap uppercase",
      tone === "ok" ? "border-[rgba(74,222,128,.32)] bg-[rgba(74,222,128,.1)] text-[#86efac]" : "border-[rgba(255,201,60,.42)] bg-[rgba(255,201,60,.12)] text-[#ffc93c]")}>{children}</span>
  );
}

function List({ id, heading, items }: { id: string; heading: string; items: string[] }) {
  return (
    <div id={id} className="flex flex-col gap-[7px] rounded-cc border border-[rgba(167,139,250,.18)] bg-white/[.03] px-[14px] py-3">
      <span className="text-[11px] font-extrabold tracking-[1px] text-cc-muted uppercase">{heading}</span>
      <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
        {items.map((x) => <li key={x} className="text-[12.5px] leading-[1.5] font-medium text-[#cbb6e6] text-pretty">• {x}</li>)}
      </ul>
    </div>
  );
}

function Status({ message }: { message: Message | undefined }) {
  if (!message) return null;
  const tone = {
    ok: "border-[rgba(74,222,128,.34)] bg-[rgba(74,222,128,.1)] text-[#a7f3c0]",
    warn: "border-[rgba(255,201,60,.4)] bg-[rgba(255,201,60,.1)] text-[#f3e6c7]",
    error: "border-[rgba(248,113,113,.4)] bg-[rgba(248,113,113,.09)] text-[#fca5a5]",
  }[message.tone];
  return <span role="status" className={cn("rounded-cc border px-[13px] py-[11px] text-[12.5px] leading-[1.5] font-semibold text-pretty", tone)}>{message.text}</span>;
}

interface ClaimState { open: boolean; confirming: boolean; accepted: boolean; claiming: boolean; message: Message | undefined }

function OfferCard({ id, name, reward, deadline, conditions, terms, state, onTerms, onAccept, onClaim }: {
  id: string; name: string; reward: string; deadline: string | null; conditions: string; terms: string[];
  state: ClaimState; onTerms: () => void; onAccept: (v: boolean) => void; onClaim: () => void;
}) {
  const { t } = useTranslation();
  const blocked = state.message?.tone === "warn";
  const canSubmit = !state.confirming || state.accepted;
  const termsId = `${id}-terms`;
  return (
    <article aria-label={name} className={CARD}>
      <Head icon="gift" name={name} reward={reward} gold chip={<Chip tone="ok">{t("bonus.chip.available")}</Chip>} />
      {deadline ? <span className="text-[12.5px] font-bold text-[#ffc93c]">{deadline}</span> : null}
      {conditions ? <span className="text-[12.5px] leading-[1.55] font-medium text-[#a795c5] text-pretty">{conditions}</span> : null}
      {state.open ? <List id={termsId} heading={t("bonus.termsHeading")} items={terms} /> : null}
      {state.confirming ? (
        <label className="flex cursor-pointer items-start gap-[10px] rounded-cc border border-[rgba(255,201,60,.3)] bg-[rgba(255,201,60,.07)] px-[13px] py-3">
          <input type="checkbox" checked={state.accepted} onChange={(e) => onAccept(e.target.checked)} className="mt-[1px] h-5 w-5 flex-none cursor-pointer accent-[#eb9c0d]" />
          <span className="min-w-0 flex-1 text-[12.5px] leading-[1.5] font-semibold text-[#f3e6c7] text-pretty">{t("bonus.accept")}</span>
        </label>
      ) : null}
      <Status message={state.message} />
      <div className="flex flex-wrap gap-2 pt-[2px]">
        <button type="button" aria-expanded={state.open} aria-controls={termsId} onClick={onTerms} className={OUTLINE}>{t(state.open ? "bonus.hideTerms" : "bonus.viewTerms")}</button>
        {!state.message?.final ? (
          <button type="button" onClick={onClaim} disabled={state.claiming || !canSubmit || blocked} aria-busy={state.claiming}
            className={cn(GOLD, "flex-[1_1_150px] px-[18px] whitespace-nowrap")}>
            {t(state.claiming ? "bonus.claiming" : state.confirming ? "bonus.confirmClaim" : "bonus.claim")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SpinsOfferCard({ id, offer, state, onTerms, onAccept, onClaim }: {
  id: string; offer: ClaimableFreeBet; state: ClaimState; onTerms: () => void; onAccept: (v: boolean) => void; onClaim: () => void;
}) {
  const { t } = useTranslation();
  const game = useGame(offer.gameIds[0] ?? "", offer.gameIds.length === 1);
  const gameName = game.data?.name ?? null;
  return (
    <OfferCard id={id} name={offer.name} reward={spinsReward(t, offer.spinsPerGame, offer.gameIds, gameName)}
      deadline={when(offer.expireAt) ? t("bonus.claimBy", { date: when(offer.expireAt) }) : null}
      conditions={offer.description?.trim() || t("bonus.spins.addedNow")} terms={spinsOfferTerms(t, offer, gameName)}
      state={state} onTerms={onTerms} onAccept={onAccept} onClaim={onClaim} />
  );
}

function ActiveCard({ id, name, reward, status, remaining, progress, expiry, details, open, onDetails, message, extra }: {
  id: string; name: string; reward: string; status: "active" | "awaiting"; remaining: string | null; progress?: Progress | null;
  expiry: string | null; details: string[]; open: boolean; onDetails: () => void; message: Message | undefined; extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const pct = progress && progress.target ? Math.max(0, Math.min(100, Math.round((progress.done / progress.target) * 100))) : 0;
  const detailsId = `${id}-details`;
  return (
    <article aria-label={name} className={CARD}>
      <Head icon="coins" name={name} reward={reward}
        chip={<Chip tone={status === "active" ? "ok" : "gold"}>{t(status === "active" ? "bonus.chip.active" : "bonus.chip.awaiting")}</Chip>} />
      {remaining ? <span className="text-[12.5px] font-semibold text-[#cbb6e6] text-pretty">{remaining}</span> : null}
      {progress ? (
        <span className="flex flex-col gap-[6px]">
          <span role="progressbar" aria-label={t("bonus.progressLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="block h-[7px] overflow-hidden rounded-full bg-white/[.07]">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#ffd766,#eb9c0d)]" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-[12px] font-semibold text-[#a795c5] text-pretty">{progress.label}</span>
        </span>
      ) : null}
      {expiry ? <span className="text-[12.5px] font-semibold text-[#a795c5]">{expiry}</span> : null}
      {open ? <List id={detailsId} heading={t("bonus.detailsHeading")} items={details} /> : null}
      <Status message={message} />
      <div className="flex flex-wrap gap-2 pt-[2px]">
        <button type="button" aria-expanded={open} aria-controls={detailsId} onClick={onDetails} className={OUTLINE}>{t(open ? "bonus.hideDetails" : "bonus.viewDetails")}</button>
        {extra}
      </div>
    </article>
  );
}

function HeldSpinsCard({ id, holding, open, onDetails, message }: { id: string; holding: PlayerFreeBet; open: boolean; onDetails: () => void; message: Message | undefined }) {
  const { t } = useTranslation();
  const single = holding.gameIds.length === 1;
  const game = useGame(holding.gameIds[0] ?? "", single);
  const gameName = game.data?.name ?? null;
  const c = heldSpinsCopy(t, holding, gameName);
  return (
    <ActiveCard id={id} name={holding.name} reward={c.reward} status="active" remaining={c.remaining} expiry={c.expiry} details={c.details}
      open={open} onDetails={onDetails} message={message}
      extra={single && gameName ? (
        <Link to="/games/$id" params={{ id: holding.gameIds[0]! }} className={cn(GOLD, "flex items-center px-[18px]")}>{t("bonus.spins.play", { game: gameName })}</Link>
      ) : null} />
  );
}
