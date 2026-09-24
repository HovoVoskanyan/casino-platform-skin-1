import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Design (UI Foundations): primary = gold gradient, ONE per view; secondary = outlined violet on a faint surface (header
   actions, min-width 108px); ghost = text only; the Telegram button is its own thing in the auth dialog. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-bold transition-[filter,background-color,border-color,color] disabled:opacity-60 disabled:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-0 bg-[image:var(--cc-gold-cta)] text-[#2c1400] font-extrabold shadow-[0_8px_22px_rgba(235,156,13,.34)] hover:brightness-105",
        secondary: "border-cc-line-strong bg-white/[.02] text-cc-text hover:bg-[rgba(167,139,250,.12)]",
        ghost: "border-transparent bg-transparent text-cc-lavender hover:text-cc-ink",
        danger: "border-cc-danger-line bg-cc-danger-soft text-cc-danger hover:brightness-110",
      },
      size: {
        sm: "h-9 rounded-cc px-3 text-[13px]",
        md: "h-10 rounded-cc px-4 text-[14px]",
        lg: "h-[54px] w-full rounded-cc-lg px-5 text-[15.5px]",
        icon: "h-10 w-10 rounded-cc px-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

/** `asChild` renders the single child (a Link) with the button's classes — Radix Slot needs exactly one element, so no spinner in that mode. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (props.type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? children : (<>{loading ? <Spinner /> : null}{children}</>)}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70", className)} />;
}

export { buttonVariants };
