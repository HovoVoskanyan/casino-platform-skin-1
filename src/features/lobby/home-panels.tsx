import { useTranslation } from "react-i18next";
import { SectionTitle } from "@/components/ui/section-title";

/**
 * Design (Home): the GCash / Maya panel and the trust strip. Static marketing copy — the methods themselves are
 * payments' list and the cashier's job; this only says which wallets the site takes.
 */
export function PaymentsPanel() {
  const { t } = useTranslation();
  const wallets = [
    { key: "gcash", img: "/gcash.jpg", name: "GCash", points: ["home.gcash.1", "home.gcash.2", "home.gcash.3"] },
    { key: "maya", img: "/maya.jpg", name: "Maya", points: ["home.maya.1", "home.maya.2", "home.maya.3"] },
  ];
  return (
    <section className="flex flex-col gap-4" aria-labelledby="payments-title">
      <span id="payments-title"><SectionTitle>{t("home.payments")}</SectionTitle></span>
      <div className="grid gap-3 sm:grid-cols-2">
        {wallets.map((w) => (
          <div key={w.key} className="flex items-center gap-4 rounded-cc-xl border border-cc-line bg-[linear-gradient(180deg,#23103f_0%,#180a2c_100%)] p-4">
            <img src={w.img} alt={w.name} className="h-14 w-14 flex-none rounded-cc-lg object-cover" />
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {w.points.map((p) => <li key={p} className="text-[13px] font-semibold text-cc-text">✓ {t(p)}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrustStrip() {
  const { t } = useTranslation();
  const items = [
    { key: "secure", img: "/icon-shield.png" },
    { key: "fast", img: "/icon-bolt.png" },
    { key: "support", img: "/icon-headset.png" },
  ];
  return (
    <section aria-label={t("home.trust")} className="flex flex-wrap items-center gap-2 rounded-cc-xl border border-cc-line bg-white/[.02] px-4 py-[14px] md:gap-4 md:px-6 md:py-5">
      {items.map((i) => (
        <div key={i.key} className="flex min-w-full flex-1 items-center gap-3 md:min-w-[170px]">
          <img src={i.img} alt="" className="h-[38px] w-[38px] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.85)]" />
          <span className="text-[14px] font-extrabold text-cc-ink">{t(`home.trust.${i.key}`)}</span>
        </div>
      ))}
    </section>
  );
}
