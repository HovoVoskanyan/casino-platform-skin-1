import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Rich copy from the translation files (owner 2026-10-13): a small, safe markdown subset rendered as React — never
 * as HTML, so a translation can format but never inject. Paragraphs split on blank lines; lines starting "- " form a
 * list; **bold**, *italic* and [label](url) inline. A link starting "/" stays in the site (router), anything else
 * opens in a new tab. Plain text renders exactly as before.
 */
export function RichText({ text, className, paragraphClassName }: { text: string; className?: string; paragraphClassName?: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i} className="m-0 flex list-disc flex-col gap-1 pl-5">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>)}
            </ul>
          );
        }
        return (
          <p key={i} className={paragraphClassName ?? "m-0"}>
            {lines.map((l, j) => <Fragment key={j}>{j > 0 ? <br /> : null}{inline(l)}</Fragment>)}
          </p>
        );
      })}
    </div>
  );
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(TOKEN).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-extrabold text-cc-ink">{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link as unknown as [string, string, string];
      if (href.startsWith("/")) return <Link key={i} to={href} className="font-bold text-cc-gold underline decoration-[rgba(255,201,60,.45)] underline-offset-4 hover:text-cc-gold-hover">{label}</Link>;
      if (/^https?:\/\//.test(href)) return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="font-bold text-cc-gold underline decoration-[rgba(255,201,60,.45)] underline-offset-4 hover:text-cc-gold-hover">{label}</a>;
      return <Fragment key={i}>{label}</Fragment>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
