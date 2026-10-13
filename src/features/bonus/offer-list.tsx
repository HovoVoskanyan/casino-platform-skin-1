import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/problem";
import { Dialog } from "@/components/ui/dialog";
import { RichText } from "@/components/ui/rich-text";
import { cn } from "@/lib/utils";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { bonusQueries, isAwaiting, isRunning, useClaimBonus, type BonusDefinition, type Offer } from "./api";
import { bonusConditions, bonusReward, bonusTerms } from "./copy";
import { OfferTile } from "./offer-tile";

/**
 * Home's Bonuses and the Promotions grid: the tiles plus the one dialog they share. A guest's Activate opens sign-in
 * (and comes back to this page); a player's opens the bonus's terms with the acceptance tick — never preselected,
 * never claimed on the first press — and Activate there opts in. Once activated the dialog and the tile both offer
 * "Deposit to claim", which opens the wallet's deposit (nothing is requested until the player submits it).
 */
export function OfferTiles({ offers, page = false }: { offers: Offer[]; page?: boolean }) {
  const [shown, setShown] = useState<{ id: string; confirm: boolean } | null>(null);
  const current = shown ? offers.find((o) => o.bonus.id === shown.id) ?? null : null;
  const here = () => window.location.pathname + window.location.search;

  return (
    <>
      {offers.map((o) => (
        <OfferTile
          key={o.bonus.id}
          offer={o}
          page={page}
          onActivate={(b) => (o.state === "guest" ? authDialog.open("signin", here()) : setShown({ id: b.id, confirm: true }))}
          onTerms={(b) => setShown({ id: b.id, confirm: false })}
        />
      ))}
      {current ? <OfferDialog key={current.bonus.id} offer={current} confirm={shown!.confirm} onClose={() => setShown(null)} /> : null}
    </>
  );
}

function OfferDialog({ offer, confirm, onClose }: { offer: Offer; confirm: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const claim = useClaimBonus();
  const { bonus, state } = offer;
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activated = done || state === "awaiting";

  async function activate(b: BonusDefinition) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await claim.mutateAsync({ bonusId: b.id });
      setDone(true);
    } catch (e) {
      const err = toApiError(e);
      if (err.status === 0 || err.status >= 500) {
        // The answer was lost, not a refusal: the opt-in may have landed — look before saying it failed.
        const rows = await qc.fetchQuery({ ...bonusQueries.active(), staleTime: 0 }).catch(() => null);
        if (rows?.some((r) => r.bonusId === b.id && (isAwaiting(r) || isRunning(r)))) setDone(true);
        else setError(t("bonus.claimError.UNKNOWN"));
      } else {
        setError(t(`bonus.claimError.${err.errorCode}`, { defaultValue: t("bonus.claimError.UNKNOWN") }));
      }
    } finally {
      setBusy(false);
    }
  }

  const gold = "flex min-h-[50px] w-full items-center justify-center rounded-cc-lg bg-[image:var(--cc-gold-cta)] px-5 text-[15px] font-extrabold text-[#2c1400] shadow-[0_8px_22px_rgba(235,156,13,.32)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55";
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())} title={bonus.name} eyebrow={t("bonus.tile.eyebrow")}>
      <div className="flex flex-col gap-[14px]">
        <span className="text-[17px] leading-[1.35] font-extrabold text-[#ffd98a]">{bonusReward(t, bonus)}</span>
        {bonusConditions(t, bonus) ? <span className="text-[13.5px] leading-[1.55] font-medium text-pretty text-cc-lavender">{bonusConditions(t, bonus)}</span> : null}
        <div className="flex flex-col gap-[7px] rounded-cc border border-[rgba(167,139,250,.18)] bg-white/[.03] px-[14px] py-3">
          <span className="text-[11px] font-extrabold tracking-[1px] text-cc-muted uppercase">{t("bonus.termsHeading")}</span>
          <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
            {bonusTerms(t, bonus).map((x) => <li key={x} className="flex gap-1 text-[12.5px] leading-[1.5] font-medium text-pretty text-[#cbb6e6]"><span aria-hidden>•</span><RichText text={x} /></li>)}
          </ul>
        </div>

        {activated ? (
          <>
            <span role="status" className="rounded-cc border border-[rgba(74,222,128,.34)] bg-[rgba(74,222,128,.1)] px-[13px] py-[11px] text-[13px] leading-[1.5] font-semibold text-pretty text-[#a7f3c0]">{t("bonus.tile.activatedLong")}</span>
            <button type="button" className={gold} onClick={() => { onClose(); void navigate({ to: "/wallet", hash: "deposit" }); }}>{t("bonus.tile.depositToClaim")}</button>
          </>
        ) : state === "guest" ? (
          <button type="button" className={gold} onClick={() => { onClose(); authDialog.open("signin", window.location.pathname + window.location.search); }}>{t("bonus.tile.signInToActivate")}</button>
        ) : state === "claimable" ? (
          <>
            <label className={cn("flex cursor-pointer items-start gap-[10px] rounded-cc border px-[13px] py-3", confirm ? "border-[rgba(255,201,60,.3)] bg-[rgba(255,201,60,.07)]" : "border-[rgba(167,139,250,.22)] bg-white/[.03]")}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-[1px] h-5 w-5 flex-none cursor-pointer accent-[#eb9c0d]" />
              <span className="min-w-0 flex-1 text-[13px] leading-[1.5] font-semibold text-pretty text-[#f3e6c7]">{t("bonus.accept")}</span>
            </label>
            {error ? <span role="alert" className="rounded-cc border border-[rgba(248,113,113,.4)] bg-[rgba(248,113,113,.09)] px-[13px] py-[11px] text-[12.5px] leading-[1.5] font-semibold text-pretty text-[#fca5a5]">{error}</span> : null}
            <button type="button" className={gold} disabled={!accepted || busy} aria-busy={busy} onClick={() => void activate(bonus)}>
              {t(busy ? "bonus.tile.activating" : "bonus.tile.activateBonus")}
            </button>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
