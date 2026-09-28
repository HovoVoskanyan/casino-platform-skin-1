import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bonuses } from "./bonuses";

/**
 * Design (Header): "View my bonuses" and the account menu's "My Bonuses" open the bonuses in place, without leaving
 * the page — a bottom sheet under 760px, a centred 620px panel above — with the same component as My Account →
 * Bonuses (`panel` variant). Focus moves in; Escape, the backdrop and ✕ close it; focus goes back to what opened it
 * (the balance chevron when the panel that held the button has gone). It closes when the page changes (a card's
 * "Play …" link) and when it unmounts on sign-out — the next player to sign in must not find it open (review F1/F2).
 */
let state: { open: boolean; returnFocus: HTMLElement | null } = { open: false, returnFocus: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const bonusDrawer = {
  open(returnFocus?: HTMLElement | null) {
    state = { open: true, returnFocus: returnFocus ?? (document.activeElement as HTMLElement | null) };
    emit();
  },
  close() {
    state = { ...state, open: false };
    emit();
  },
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

export function BonusDrawer() {
  const { t } = useTranslation();
  const { open, returnFocus } = useSyncExternalStore(bonusDrawer.subscribe, bonusDrawer.get, bonusDrawer.get);
  const path = useRouterState({ select: (s) => s.location.href });
  const shownOn = useRef(path);
  useEffect(() => {
    if (shownOn.current !== path) bonusDrawer.close();
    shownOn.current = path;
  }, [path]);
  useEffect(() => () => bonusDrawer.close(), []);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? bonusDrawer.open() : bonusDrawer.close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-[rgba(6,2,12,.76)] backdrop-blur-[5px] data-[state=open]:animate-cc-fade" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(e) => {
            if (returnFocus?.isConnected) {
              e.preventDefault();
              returnFocus.focus();
            }
          }}
          className="fixed inset-x-0 bottom-0 z-[300] flex max-h-[88vh] flex-col overflow-hidden rounded-t-[20px] bg-[linear-gradient(170deg,#2a1049_0%,#1a0930_45%,#160726_100%)] shadow-[0_30px_80px_rgba(4,1,9,.75)] outline-none data-[state=open]:animate-cc-rise min-[760px]:inset-x-auto min-[760px]:top-1/2 min-[760px]:bottom-auto min-[760px]:left-1/2 min-[760px]:max-h-[calc(100vh-48px)] min-[760px]:w-[min(620px,calc(100vw-48px))] min-[760px]:-translate-x-1/2 min-[760px]:-translate-y-1/2 min-[760px]:rounded-[20px] min-[760px]:border min-[760px]:border-[rgba(167,139,250,.26)]"
        >
          <div className="flex flex-none items-start justify-between gap-3 border-b border-[rgba(167,139,250,.14)] px-5 pt-[18px] pb-[14px]">
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[10.5px] font-extrabold tracking-[1.2px] text-cc-muted uppercase">{t("bonus.eyebrow")}</span>
              <DialogPrimitive.Title className="m-0 text-[19px] font-extrabold tracking-[-.3px] text-cc-ink">{t("bonus.title")}</DialogPrimitive.Title>
            </span>
            <DialogPrimitive.Close aria-label={t("common.close")} className="flex h-10 w-10 flex-none items-center justify-center rounded-cc border border-[rgba(167,139,250,.28)] bg-white/[.06] text-[15px] font-extrabold text-[#cbb6e6] hover:bg-white/[.14] hover:text-cc-ink">✕</DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">{t("bonus.subtitle")}</DialogPrimitive.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
            {open ? <Bonuses variant="panel" /> : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
