import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Shell } from "@/components/layout/shell";
import { RichText } from "@/components/ui/rich-text";
import { SupportButton } from "@/features/support/support-button";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";

const PAGES = ["responsible-gaming", "faq", "terms", "privacy"] as const;
type InfoPage = (typeof PAGES)[number];

export const Route = createFileRoute("/info/$page")({
  beforeLoad: ({ params }) => {
    if (!(PAGES as readonly string[]).includes(params.page)) throw notFound();
  },
  component: InfoPageView,
});

/** The catalog's shape for one page (`info.page.<page>`) — the design's 24 Sep 2026 content pack, verbatim. */
type Block = { t: "p"; text: string } | { t: "req"; label?: string; text: string } | { t: "link"; text: string; href: string } | { t: "support" };
interface PageCopy {
  title: string;
  intro: string;
  draftLabel: string;
  draftNote: string;
  sections?: { id: string; title: string; blocks: Block[] }[];
}
/** `info.faq.groups`: each answer may point somewhere in the site (`to`) or offer Contact support. */
type FaqDest = "wallet" | "promotions" | "account-bonuses" | "account-profile" | "account-security" | "responsible-gaming";
interface FaqGroup {
  id: string;
  title: string;
  items: { id: string; q: string; a: string; link?: string; to?: FaqDest; support?: boolean }[];
}

/**
 * REQUIRED blocks are the design's notes to the operator (legal entity, licence, dates, complaint channel…), not
 * player copy: local builds show them so the gaps stay visible while the copy is reviewed; a deployed build leaves
 * them out, and a section with nothing else to say goes with them.
 */
const SHOW_REQUIRED = import.meta.env.DEV;

/**
 * Design (Info): Responsible Gaming, Terms and Privacy as documents with an "On this page" index; the FAQ as a
 * searchable accordion by topic with links into the site and Contact support. The copy is the owner's unapproved
 * draft until they sign it off (P3-22 open item), so the design's draft note stays on every page.
 */
function InfoPageView() {
  const { t } = useTranslation();
  const page = Route.useParams().page as InfoPage;
  const copy = t(`info.page.${page}`, { returnObjects: true }) as PageCopy;
  const sections = (copy.sections ?? [])
    .map((s) => ({ ...s, blocks: s.blocks.filter((b) => SHOW_REQUIRED || b.t !== "req") }))
    .filter((s) => s.blocks.length > 0);
  useSeo({ title: copy.title, description: copy.intro.replace(/<[^>]+>/g, ""), path: `/info/${page}` });

  return (
    <Shell>
      <div className="flex min-w-0 flex-col gap-[22px]">
        <nav aria-label={t("info.breadcrumb")}>
          <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[13.5px] font-semibold">
            <li className="flex"><Link to="/" className="flex min-h-11 items-center text-cc-lavender hover:text-white">{t("info.home")}</Link></li>
            <li aria-hidden className="text-[#6f5a8f]">/</li>
            <li aria-current="page" className="text-cc-label">{copy.title}</li>
          </ol>
        </nav>

        <div className="flex max-w-[760px] flex-col gap-[10px]">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-[30px] w-1 flex-none rounded-full bg-[image:var(--cc-gold-bar)] shadow-[0_0_12px_rgba(240,150,10,.5)]" />
            <h1 className="m-0 text-[28px] leading-[1.15] font-extrabold tracking-[-0.7px] [overflow-wrap:anywhere] text-cc-ink min-[600px]:text-[34px]">{copy.title}</h1>
          </div>
          <p className="m-0 pl-4 text-[16px] leading-[1.6] font-medium text-pretty text-cc-lavender">{copy.intro}</p>
        </div>

        <div className="flex max-w-[760px] flex-wrap items-baseline gap-x-3 gap-y-[6px] rounded-cc-lg border border-dashed border-[rgba(255,201,60,.4)] bg-[rgba(255,201,60,.06)] px-4 py-3">
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-cc-gold">{copy.draftLabel}</span>
          <span className="min-w-0 flex-[1_1_260px] text-[13.5px] leading-[1.55] font-medium text-pretty text-[#f3e6c7]">{copy.draftNote}</span>
        </div>

        {page === "faq" ? <Faq /> : (
          <WithIndex title={t("info.toc.doc")} label={t("info.toc.docLabel")} entries={sections.map((s) => ({ id: s.id, label: s.title }))}>
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-24 flex-col gap-[14px]">
                <h2 id={`${s.id}-h`} className="m-0 text-[22px] leading-[1.3] font-extrabold tracking-[-0.4px] text-pretty text-cc-ink">{s.title}</h2>
                {s.blocks.map((b, i) => <DocBlock key={i} block={b} />)}
              </section>
            ))}
          </WithIndex>
        )}
      </div>
    </Shell>
  );
}

const BODY = "m-0 text-[16px] leading-[1.6] font-medium text-pretty [overflow-wrap:anywhere] text-[#cfc2e3]";
const GOLD_BUTTON = "flex min-h-11 items-center self-start rounded-cc-md bg-[image:var(--cc-gold-cta)] px-[22px] text-[14px] font-extrabold text-[#2c1400] shadow-[0_8px_22px_rgba(235,156,13,.3)] hover:brightness-105";

function DocBlock({ block }: { block: Block }) {
  const { t } = useTranslation();
  switch (block.t) {
    case "p":
      return <RichText text={block.text} className="flex flex-col gap-3" paragraphClassName={BODY} />;
    case "link":
      return (
        <a href={block.href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 max-w-full items-center gap-2 self-start text-[16px] leading-[1.45] font-bold [overflow-wrap:anywhere] text-cc-gold underline decoration-[rgba(255,201,60,.45)] underline-offset-4 hover:text-cc-gold-hover">
          {block.text}
          <span aria-hidden className="flex-none no-underline">↗</span>
          <span className="sr-only">{t("info.opensNewTab")}</span>
        </a>
      );
    case "support":
      return <SupportButton dot={false} className={GOLD_BUTTON}>{t("info.contactSupport")}</SupportButton>;
    case "req":
      return (
        <div className="flex flex-col gap-[6px] rounded-cc-lg border border-dashed border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.05)] px-4 py-[13px]">
          <span className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
            <span className="flex h-[22px] items-center rounded-[6px] bg-[rgba(167,139,250,.16)] px-2 text-[10.5px] font-extrabold tracking-[1px] text-[#c4b5fd]">{t("info.required")}</span>
            {block.label ? <span className="text-[14.5px] font-extrabold text-cc-label">{block.label}</span> : null}
          </span>
          <span className="text-[14px] leading-[1.55] font-medium text-pretty [overflow-wrap:anywhere] text-cc-lavender">{block.text}</span>
        </div>
      );
  }
}

/** The page index: a sticky 220px column from 900px (kept while an FAQ search empties it); above the content below that, when it has two entries or more. */
function WithIndex({ title, label, entries, children }: { title: string; label: string; entries: { id: string; label: string }[]; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 min-[900px]:grid-cols-[220px_minmax(0,720px)] min-[900px]:gap-10">
      <nav aria-label={label} className={cn("flex min-w-0 flex-col gap-1 rounded-[16px] border border-[rgba(167,139,250,.18)] bg-white/[.03] px-4 py-[14px] min-[900px]:sticky min-[900px]:top-[100px]", entries.length < 2 && "max-[899px]:hidden")}>
        <span className="pb-[6px] text-[11px] font-extrabold tracking-[1.1px] text-cc-muted">{title}</span>
        <ol className="m-0 flex list-none flex-col gap-[2px] p-0">
          {entries.map((e) => (
            <li key={e.id} className="flex">
              <a href={`#${e.id}`} className="-mx-2 flex min-h-10 flex-1 items-center rounded-[9px] px-2 py-[6px] text-[14px] leading-[1.35] font-semibold text-pretty text-[#cbb6e6] hover:bg-white/[.05] hover:text-white">{e.label}</a>
            </li>
          ))}
        </ol>
        {entries.length === 0 ? <span className="text-[13.5px] leading-[1.5] font-medium text-cc-muted">{t("info.toc.empty")}</span> : null}
      </nav>
      <div className="flex max-w-[760px] min-w-0 flex-col gap-[34px]">{children}</div>
    </div>
  );
}

/** Where an FAQ answer's button goes. Wallet and My Account keep their own sign-in gates for guests. */
function FaqLink({ to, children }: { to: FaqDest; children: ReactNode }) {
  const cls = "flex min-h-11 items-center gap-2 rounded-cc-md border border-[rgba(167,139,250,.32)] bg-white/[.03] px-4 text-[14px] font-bold whitespace-nowrap text-white hover:border-[rgba(167,139,250,.6)] hover:bg-white/[.06] hover:text-white";
  const label = <>{children} <span aria-hidden className="text-[#c4b5fd]">→</span></>;
  switch (to) {
    case "wallet": return <Link to="/wallet" className={cls}>{label}</Link>;
    case "promotions": return <Link to="/promotions" className={cls}>{label}</Link>;
    case "account-bonuses": return <Link to="/account" search={{ tab: "bonuses" }} className={cls}>{label}</Link>;
    case "account-security": return <Link to="/account" search={{ tab: "security" }} className={cls}>{label}</Link>;
    case "account-profile": return <Link to="/account" className={cls}>{label}</Link>;
    case "responsible-gaming": return <Link to="/info/$page" params={{ page: "responsible-gaming" }} className={cls}>{label}</Link>;
  }
}

function Faq() {
  const { t } = useTranslation();
  const groups = t("info.faq.groups", { returnObjects: true }) as FaqGroup[];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Every word must appear somewhere in the topic, the question, the answer or its link.
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => words.every((w) => `${g.title} ${it.q} ${it.a} ${it.link ?? ""}`.toLowerCase().includes(w))) }))
    .filter((g) => g.items.length > 0);
  const count = shown.reduce((n, g) => n + g.items.length, 0);

  return (
    <WithIndex title={t("info.toc.faq")} label={t("info.toc.faqLabel")} entries={shown.map((g) => ({ id: `faq-${g.id}`, label: g.title }))}>
      <div role="search" className="flex flex-col gap-2">
        <label htmlFor="faq-search" className="text-[14px] font-bold text-cc-label">{t("info.faq.search")}</label>
        <div className="relative flex">
          <input
            id="faq-search"
            type="search"
            value={query}
            autoComplete="off"
            aria-describedby="faq-count"
            placeholder={t("info.faq.searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape" && query) { e.stopPropagation(); setQuery(""); } }}
            className={cn("h-[50px] min-w-0 flex-1 rounded-cc-md border border-[rgba(167,139,250,.3)] bg-black/[.32] pl-4 text-[16px] font-medium text-white placeholder:text-cc-muted focus:border-[rgba(255,201,60,.6)] focus:outline-none [&::-webkit-search-cancel-button]:hidden", query ? "pr-[52px]" : "pr-4")}
          />
          {query ? (
            <button type="button" aria-label={t("info.faq.clear")} onClick={() => { setQuery(""); document.getElementById("faq-search")?.focus(); }} className="absolute top-[3px] right-[3px] h-11 w-11 rounded-cc text-[15px] font-extrabold text-[#cbb6e6] hover:bg-white/[.08] hover:text-white">✕</button>
          ) : null}
        </div>
        <span id="faq-count" role="status" className="text-[13px] font-medium text-cc-muted">
          {words.length === 0 ? t("info.faq.count", { count }) : count === 0 ? t("info.faq.noMatches") : t("info.faq.matches", { count })}
        </span>
      </div>

      {shown.map((g) => (
        <section key={g.id} id={`faq-${g.id}`} aria-labelledby={`faq-${g.id}-h`} className="flex scroll-mt-24 flex-col gap-[10px]">
          <h2 id={`faq-${g.id}-h`} className="m-0 text-[20px] font-extrabold tracking-[-0.3px] text-cc-ink">{g.title}</h2>
          {g.items.map((it) => {
            const on = !!open[it.id];
            return (
              <div key={it.id} className={cn("overflow-hidden rounded-cc-lg border bg-white/[.03] transition-colors", on ? "border-[rgba(255,201,60,.32)]" : "border-[rgba(167,139,250,.18)]")}>
                <h3 className="m-0">
                  <button type="button" id={`faq-q-${it.id}`} aria-expanded={on} aria-controls={`faq-a-${it.id}`} onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))} className="flex min-h-14 w-full items-center gap-[14px] px-[18px] py-[14px] text-left hover:bg-white/[.03]">
                    <span className="min-w-0 flex-1 text-[15.5px] leading-[1.45] font-bold text-pretty text-white">{it.q}</span>
                    <span aria-hidden className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-[8px] border text-[15px] leading-none font-extrabold", on ? "border-[rgba(255,201,60,.45)] bg-[rgba(255,201,60,.12)] text-cc-gold" : "border-[rgba(167,139,250,.26)] bg-white/[.04] text-[#c4b5fd]")}>{on ? "−" : "+"}</span>
                  </button>
                </h3>
                {on ? (
                  <div id={`faq-a-${it.id}`} role="region" aria-labelledby={`faq-q-${it.id}`} className="flex flex-col items-start gap-[14px] px-[18px] pb-[18px]">
                    <RichText text={it.a} className="flex flex-col gap-3" paragraphClassName={BODY} />
                    {it.to && it.link ? <FaqLink to={it.to}>{it.link}</FaqLink> : null}
                    {it.support ? <SupportButton dot={false} className={cn(GOLD_BUTTON, "px-5")}>{t("info.contactSupport")}</SupportButton> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}

      {count === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-cc-xl border border-dashed border-[rgba(167,139,250,.3)] bg-white/[.02] px-[22px] py-7 text-center">
          <span className="text-[16px] leading-[1.5] font-bold [overflow-wrap:anywhere] text-white">{t("info.faq.noResultsTitle")}</span>
          <span className="text-[14px] leading-[1.55] font-medium text-pretty text-cc-lavender">{t("info.faq.noResultsHint")}</span>
          <div className="flex flex-wrap justify-center gap-[10px]">
            <button type="button" onClick={() => { setQuery(""); document.getElementById("faq-search")?.focus(); }} className="min-h-11 rounded-cc-md border border-[rgba(167,139,250,.36)] bg-white/[.04] px-5 text-[14px] font-bold whitespace-nowrap text-white hover:bg-white/[.08]">{t("info.faq.clear")}</button>
            <SupportButton dot={false} className={cn(GOLD_BUTTON, "self-auto px-5")}>{t("info.contactSupport")}</SupportButton>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-cc-xl border border-[rgba(167,139,250,.16)] bg-[linear-gradient(180deg,rgba(255,255,255,.045)_0%,rgba(255,255,255,.02)_100%)] px-5 py-[18px]">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <span className="text-[17px] font-extrabold tracking-[-0.2px] text-white">{t("info.faq.stillTitle")}</span>
          <span className="text-[14px] leading-[1.55] font-medium text-cc-lavender">{t("info.faq.stillHint")}</span>
        </div>
        <SupportButton dot={false} className={cn(GOLD_BUTTON, "self-auto")}>{t("info.contactSupport")}</SupportButton>
      </div>
    </WithIndex>
  );
}
