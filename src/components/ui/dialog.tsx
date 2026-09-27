import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The design's dialog (the auth dialog and the transaction detail are the reference): full-screen on phones, a
 * centred 22px-radius box from `sm` up, a sticky head with an optional eyebrow, the title and a ✕. Radix gives the
 * focus trap, Escape and focus return. P3-28: the launch prompts and the cashier.
 */
export function Dialog({
  open, onOpenChange, title, eyebrow, description, children, width = 460, closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Read by assistive tech; shown under the title when `visibleDescription`. */
  description?: ReactNode;
  children: ReactNode;
  width?: number;
  closeLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-cc-canvas-base data-[state=open]:animate-cc-fade sm:bg-cc-scrim" />
        <DialogPrimitive.Content
          style={{ ["--cc-dialog-w" as string]: `${width}px` }}
          className={cn(
            "fixed inset-0 z-[200] flex flex-col gap-4 overflow-y-auto bg-[image:var(--cc-dialog)] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] outline-none data-[state=open]:animate-cc-rise",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[calc(100vh-48px)] sm:w-[min(var(--cc-dialog-w),calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-cc-2xl sm:border sm:border-[rgba(167,139,250,.26)] sm:px-[26px] sm:pb-[26px] sm:shadow-[0_30px_80px_rgba(4,1,9,.7)]",
          )}
        >
          <div className="sticky top-0 z-10 -mx-5 flex items-start justify-between gap-3 border-b border-[rgba(167,139,250,.14)] bg-[#2a1049] px-5 pt-[18px] pb-[14px] sm:-mx-[26px] sm:px-[26px] sm:pt-[22px]">
            <div className="flex min-w-0 flex-col gap-1">
              {eyebrow ? <span className="text-[10.5px] font-extrabold tracking-[1.2px] text-cc-muted uppercase">{eyebrow}</span> : null}
              <DialogPrimitive.Title className="m-0 text-[19px] font-extrabold leading-[1.25] text-cc-ink">{title}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close aria-label={closeLabel ?? t("common.close")} className="flex h-10 w-10 flex-none items-center justify-center rounded-cc-md border border-cc-line-strong bg-white/[.06] text-[#cbb6e6]">✕</DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className="m-0 text-[14px] leading-[1.55] text-cc-text">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
