import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Design (Registration): 52px fields, 14px radius, faint surface, violet line, gold glow on focus, rose on error. */
const field =
  "h-[52px] w-full rounded-cc-lg border border-cc-line-strong bg-white/[.03] px-4 text-[15px] font-semibold text-cc-ink outline-none transition-[border-color,box-shadow] focus:border-[rgba(255,201,60,.55)] focus:shadow-[0_0_0_3px_rgba(255,201,60,.14)] aria-invalid:border-[rgba(248,113,113,.6)] aria-invalid:shadow-[0_0_0_3px_rgba(248,113,113,.14)] disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, className)} {...props} />
));
Input.displayName = "Input";

/** Label + control + inline error or hint, the only way a form field is laid out. */
export function Field({ label, htmlFor, error, hint, children, className }: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = htmlFor ? `${htmlFor}-msg` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-bold tracking-[.2px] text-cc-label">{label}</label>
      {children}
      {error ? (
        <span id={describedBy} role="alert" className="text-[12px] font-semibold leading-[1.4] text-cc-danger">{error}</span>
      ) : hint ? (
        <span id={describedBy} className="text-[12px] font-semibold leading-[1.4] text-cc-muted">{hint}</span>
      ) : null}
    </div>
  );
}
