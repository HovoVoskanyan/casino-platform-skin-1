import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The phone balance panel's action row (owner reference, 2026-10-13): a gold Deposit — the primary action — beside a
 * purple "View my bonuses", ~41/59, 52px tall. Each button's floor is its own content (icon, one-line label, arrow),
 * so when both cannot sit on one line they stack, full width, Deposit first (side by side from a 390px phone up,
 * stacked on 320–360px). Desktop keeps its single button.
 */
export function BalanceActions({ onDeposit, onBonuses }: { onDeposit: () => void; onBonuses: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-[10px] pt-1">
      <ActionButton
        onClick={onDeposit}
        icon={<WalletPlusIcon />}
        className="flex-[41_1_0%] border-[#ffe08a] bg-[linear-gradient(180deg,#ffe766_0%,#ffcf3c_42%,#f7a417_78%,#ee8a0a_100%)] text-[#2a0f45] shadow-[inset_0_1px_0_rgba(255,250,214,.95),inset_0_-2px_0_rgba(190,92,0,.45),0_2px_0_#b8620a,0_6px_16px_rgba(245,154,11,.38)]"
        arrow="bg-[rgba(255,255,255,.22)] border-[rgba(160,82,0,.28)] text-[#2a0f45]"
      >
        {t("nav.deposit")}
      </ActionButton>
      <ActionButton
        onClick={onBonuses}
        icon={<GiftIcon />}
        className="flex-[59_1_0%] border-[rgba(255,201,60,.85)] bg-[linear-gradient(180deg,#a646ec_0%,#7524cc_40%,#4d1395_78%,#3a0c78_100%)] text-white shadow-[inset_0_1px_0_rgba(240,180,255,.75),inset_0_-2px_0_rgba(26,5,60,.5),0_2px_0_#2a0758,0_6px_16px_rgba(150,60,240,.4)]"
        arrow="bg-[#24084d] border-[rgba(255,201,60,.35)] text-cc-gold"
      >
        {t("balance.viewBonuses")}
      </ActionButton>
    </div>
  );
}

function ActionButton({ onClick, icon, className, arrow, children }: { onClick: () => void; icon: ReactNode; className: string; arrow: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[52px] min-w-max items-center gap-[5px] rounded-[16px] border pr-[6px] pl-2 transition-[filter,transform] hover:brightness-[1.06] active:translate-y-[1px]",
        className,
      )}
    >
      <span aria-hidden className="flex h-[26px] w-[26px] flex-none items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 text-center text-[14.5px] leading-none font-extrabold tracking-[-0.1px] whitespace-nowrap">{children}</span>
      <span aria-hidden className={cn("flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border", arrow)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </span>
    </button>
  );
}

/** A plum wallet with a gold "+" coin on its corner. */
function WalletPlusIcon() {
  const id = useId();
  return (
    <svg width="26" height="26" viewBox="0 0 32 32">
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a3596" /><stop offset="1" stopColor="#2e1050" /></linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff07a" /><stop offset="1" stopColor="#f5b20f" /></linearGradient>
      </defs>
      <path d="M5 9.5 21.5 5a2 2 0 0 1 2.5 1.9V9" fill="#3d1a63" />
      <rect x="3" y="8.5" width="23" height="17" rx="3.5" fill={`url(#${id}w)`} />
      <rect x="3.6" y="9.1" width="21.8" height="2" rx="1" fill="rgba(255,255,255,.18)" />
      <circle cx="24" cy="23" r="6" fill={`url(#${id}c)`} stroke="#c47c06" strokeWidth=".8" />
      <path d="M24 20.2v5.6M21.2 23h5.6" stroke="#2a0f45" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A plum gift box tied with a gold ribbon. */
function GiftIcon() {
  const id = useId();
  return (
    <svg width="26" height="26" viewBox="0 0 32 32">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7a3fb0" /><stop offset="1" stopColor="#3a1366" /></linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe36b" /><stop offset="1" stopColor="#f1a20c" /></linearGradient>
      </defs>
      <path d="M16 10c-1.6-4.4-7.2-5.4-7.4-2.2-.2 2.6 4.4 3 7.4 2.2zM16 10c1.6-4.4 7.2-5.4 7.4-2.2.2 2.6-4.4 3-7.4 2.2z" fill={`url(#${id}r)`} stroke="#b97207" strokeWidth=".7" />
      <rect x="5" y="14" width="22" height="13.5" rx="2.2" fill={`url(#${id}b)`} />
      <rect x="4" y="10" width="24" height="5.2" rx="1.8" fill="#8a4cc2" />
      <rect x="13.6" y="10" width="4.8" height="17.5" fill={`url(#${id}r)`} />
      <circle cx="16" cy="10" r="1.9" fill="#ffd84a" stroke="#b97207" strokeWidth=".6" />
    </svg>
  );
}
