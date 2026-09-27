import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { methodArt, type Method } from "./api";

/** The e-wallets as the design draws them on Home (GCash, Maya art), as a radio group. */
export function MethodPicker({ methods, value, onChange, label }: { methods: Method[]; value: string | null; onChange: (id: string) => void; label: string }) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {methods.map((m) => {
        const art = methodArt(m);
        const selected = value === m.methodId;
        return (
          <button key={m.methodId} type="button" role="radio" aria-checked={selected} onClick={() => onChange(m.methodId)}
            className={cn("flex h-[64px] items-center gap-3 rounded-cc-lg border px-3 text-left transition-colors",
              selected ? "border-[rgba(255,201,60,.6)] bg-[rgba(255,201,60,.1)]" : "border-cc-line-strong bg-white/[.03] hover:bg-white/[.05]")}>
            {art ? <img src={art} alt="" className="h-9 w-9 flex-none rounded-[9px] object-cover" /> : <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] border border-cc-line-strong text-[13px] font-extrabold text-cc-control">{m.name[0]}</span>}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14.5px] font-bold text-cc-ink">{m.name}</span>
              <span className="text-[11.5px] text-cc-muted">{t("cashier.eWallet")}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
