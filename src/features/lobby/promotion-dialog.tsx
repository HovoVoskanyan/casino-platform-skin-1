import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/ui/notice";
import { ApiError } from "@/api/problem";
import { usePromotion } from "./api";
import { PromotionMark, usePromotionTag } from "./promotion-card";

/**
 * "View Details": the promotion's full terms over the Promotions page. The open promotion rides in the URL
 * (`?promo=<id>`), so a hero banner or a Home card can link straight to it and a reload keeps it open. An offer that
 * has ended (or never existed) says so instead of showing stale terms.
 */
export function PromotionDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const tag = usePromotionTag();
  const { data, isPending, error } = usePromotion(id);
  const gone = error instanceof ApiError && error.status === 404;

  return (
    <DialogPrimitive.Root open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-cc-scrim backdrop-blur-[2px] data-[state=open]:animate-cc-fade" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-[image:var(--cc-dialog)] p-5 outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[86vh] sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-cc-2xl sm:border sm:border-cc-line-strong sm:p-7 sm:shadow-[0_30px_80px_rgba(0,0,0,.6)]">
          <div className="flex items-start gap-3">
            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-cc-lg border border-[rgba(255,201,60,.28)] bg-[rgba(255,201,60,.08)]"><PromotionMark category={data?.category} /></span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {data ? <span className="text-[10.5px] font-extrabold tracking-[1.2px] text-cc-gold">{tag(data.category)}</span> : null}
              <DialogPrimitive.Title className="m-0 text-[22px] font-extrabold leading-[1.2] text-cc-ink">{data?.title ?? t("promotions.detailsTitle")}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close aria-label={t("common.close")} className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-cc-line-strong text-cc-control hover:text-cc-ink">✕</DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">{t("promotions.detailsDescription")}</DialogPrimitive.Description>
          {isPending && id ? <p className="m-0 text-[13px] text-cc-muted">{t("common.loading")}</p> : null}
          {gone ? <Notice tone="info">{t("promotions.ended")}</Notice> : error && !gone ? <Notice tone="error">{t("common.loadFailed")}</Notice> : null}
          {data ? (
            <>
              {data.value ? <p className="m-0 text-[24px] font-extrabold tracking-[-0.3px] text-cc-gold-hover">{data.value}</p> : null}
              {data.body ? <p className="m-0 text-[14px] font-medium leading-[1.55] text-cc-text">{data.body}</p> : null}
              {data.endsAt ? <p className="m-0 text-[12.5px] font-semibold text-cc-lavender">{t("promotions.endsAt", { date: new Date(data.endsAt) })}</p> : null}
              <section className="flex flex-col gap-2 rounded-cc-lg border border-cc-line bg-white/[.02] p-4">
                <h3 className="m-0 text-[13px] font-extrabold tracking-[.6px] text-cc-label uppercase">{t("promotions.terms")}</h3>
                <p className="m-0 whitespace-pre-line text-[13px] leading-[1.6] text-cc-control">{data.terms ?? t("promotions.noTerms")}</p>
              </section>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
