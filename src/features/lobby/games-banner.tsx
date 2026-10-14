import { useTranslation } from "react-i18next";

/**
 * The supplied banner's "Explore games" pill, as a share of the artwork (1970×538) — the live button sits exactly on it.
 * Re-measure these if `games-banner.webp` is replaced.
 */
const PILL = "@min-[640px]:left-[5.23%] @min-[640px]:top-[74.72%] @min-[640px]:h-[17.29%] @min-[640px]:w-[22.28%]";

/**
 * Games hero (owner visual 2026-10-14). From 640px of banner it is the owner's artwork itself (`games-banner.webp`,
 * text, tiger and tagline baked in): the headline and line stay in the page for screen readers and search, and the real
 * "Explore games" button lies invisibly over the drawn one, keeping its focus ring. Under 640px the artwork's text would
 * shrink to nothing, so phones get the live two-column composition — headline, line and button on the left, the
 * tiger over glossy CSS spheres on the right, no tagline — laid out on the banner's own width (container queries).
 */
export function GamesBanner({ onExplore }: { onExplore: () => void }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="games-banner-title" className="@container">
      <div className="relative overflow-hidden rounded-[20px] border-2 border-[#b14dff] bg-[linear-gradient(100deg,#1c0950_0%,#2a0c70_38%,#4512a6_68%,#5a17c6_100%)] shadow-[inset_0_0_22px_rgba(190,90,255,.45),0_0_22px_rgba(177,77,255,.55),0_18px_44px_rgba(6,3,11,.55)] @min-[640px]:overflow-visible @min-[640px]:border-0 @min-[640px]:bg-none @min-[640px]:shadow-none">
        <Bubbles />
        <img
          src="/games-banner.webp"
          srcSet="/games-banner-md.webp 1200w, /games-banner.webp 1970w"
          sizes="(min-width: 1024px) 980px, 100vw"
          width={1970}
          height={538}
          alt=""
          className="hidden h-auto w-full drop-shadow-[0_16px_30px_rgba(6,3,11,.55)] select-none @min-[640px]:block"
        />
        <div className="relative grid min-h-[196px] grid-cols-[minmax(0,1fr)_clamp(96px,37cqw,168px)] items-center gap-[6px] py-[18px] pr-2 pl-[18px] @min-[640px]:absolute @min-[640px]:inset-0 @min-[640px]:block @min-[640px]:min-h-0 @min-[640px]:p-0">
          <div className="flex min-w-0 flex-col items-start">
            <h1 id="games-banner-title" className="m-0 text-[clamp(21px,7.3cqw,28px)] leading-[1.06] font-extrabold tracking-[-0.6px] text-balance text-cc-ink @min-[640px]:sr-only">
              {t("games.titleLead")}{" "}
              <span className="block w-fit bg-[linear-gradient(180deg,#fff04d_0%,#ffc61a_45%,#ff9500_100%)] bg-clip-text pr-[0.06em] pb-[0.04em] text-transparent [filter:drop-shadow(0_0_14px_rgba(255,170,0,.35))]">{t("games.titleAccent")}</span>
            </h1>
            <p className="mt-2 mb-0 text-[14px] leading-[1.4] font-semibold text-pretty text-[#d2c0ff] @min-[640px]:sr-only">{t("games.subtitle")}</p>
            <button
              type="button"
              onClick={onExplore}
              className={`tap-44 mt-[14px] inline-flex min-h-11 items-center gap-[5px] rounded-full border-2 border-[#ffcc1f] bg-[rgba(14,4,36,.72)] px-3 text-[13.5px] font-bold whitespace-nowrap text-cc-ink shadow-[0_0_16px_rgba(255,204,31,.35)] transition-[background-color,box-shadow] hover:bg-[rgba(255,204,31,.14)] hover:shadow-[0_0_24px_rgba(255,204,31,.32)] @min-[320px]:gap-[6px] @min-[320px]:px-[18px] @min-[320px]:text-[14px] @min-[640px]:absolute @min-[640px]:m-0 @min-[640px]:min-h-0 @min-[640px]:border-transparent @min-[640px]:bg-transparent @min-[640px]:text-transparent @min-[640px]:shadow-none @min-[640px]:hover:bg-[rgba(255,204,31,.1)] @min-[640px]:hover:shadow-[0_0_24px_rgba(255,204,31,.4)] ${PILL}`}
            >
              {t("games.explore")}
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <img
            src="/chocho-tiger-sm.webp"
            srcSet="/chocho-tiger-sm.webp 260w, /chocho-tiger.webp 480w"
            sizes="168px"
            width={480}
            height={453}
            alt=""
            className="pointer-events-none w-full self-center object-contain drop-shadow-[0_0_22px_rgba(205,110,255,.55)] select-none @min-[640px]:hidden"
          />
        </div>
      </div>
    </section>
  );
}

/** The phone composition's glossy violet spheres, drawn in CSS to match the artwork: lit top left, dark at the rim. */
function Bubbles() {
  const sphere = "pointer-events-none absolute aspect-square rounded-full bg-[radial-gradient(circle_at_32%_28%,#ee97ff_0%,#bf45ff_20%,#9a25f5_48%,#7414dc_76%,#5a0dbb_100%)] shadow-[inset_-16px_-20px_46px_rgba(40,0,110,.6),inset_6px_8px_18px_rgba(255,190,255,.18),0_0_30px_rgba(180,70,255,.4)]";
  return (
    <span aria-hidden className="absolute inset-0 @min-[640px]:hidden">
      <span className="absolute inset-0 bg-[radial-gradient(38%_70%_at_66%_50%,rgba(205,100,255,.26)_0%,transparent_70%),radial-gradient(50%_80%_at_0%_100%,rgba(140,60,255,.22)_0%,transparent_70%)]" />
      <span className={`${sphere} top-[6%] right-[-16%] w-[62cqw]`} />
      <span className={`${sphere} top-[-30%] right-[-12%] w-[30cqw] opacity-80`} />
      <span className={`${sphere} bottom-[-36%] left-[44%] w-[36cqw] opacity-60`} />
    </span>
  );
}
