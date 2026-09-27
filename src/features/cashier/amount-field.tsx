import { useTranslation } from "react-i18next";
import { Field, Input } from "@/components/ui/input";
import { peso } from "@/lib/money";

/** A peso amount with the ₱ prefix, the method's range under it, and optional quick picks (whole pesos). */
export function AmountField({ id, label, value, onChange, error, minCents, maxCents, quick = [] }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; minCents?: number; maxCents?: number; quick?: number[];
}) {
  const { t } = useTranslation();
  const hint = minCents != null && maxCents != null ? t("cashier.range", { min: peso(minCents), max: peso(maxCents) }) : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Field label={label} htmlFor={id} hint={hint} error={error}>
        <div className="relative flex">
          <span aria-hidden className="absolute left-0 top-0 flex h-full items-center border-r border-cc-line-strong px-[14px] text-[16px] font-bold text-cc-text">₱</span>
          <Input id={id} inputMode="decimal" autoComplete="off" placeholder="0.00" className="pl-[52px] text-[17px] font-bold tabular" aria-invalid={!!error}
            value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      </Field>
      {quick.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quick.map((pesos) => (
            <button key={pesos} type="button" onClick={() => onChange(String(pesos))}
              className="h-9 rounded-full border border-[rgba(167,139,250,.24)] bg-white/[.03] px-4 text-[13px] font-bold text-[#bfaed8] hover:text-cc-ink">
              {peso(pesos * 100).replace(".00", "")}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
