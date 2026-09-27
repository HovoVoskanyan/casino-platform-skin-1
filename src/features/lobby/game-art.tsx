import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A game's picture. The catalogue's thumbnail when it has one; otherwise a deterministic gradient keyed by the
 * name (the design's per-game gradients), so a game without art still reads as a tile, never a broken image — and
 * the same happens when the thumbnail fails to load (a provider CDN that is down or a stale URL).
 */
const PALETTES = [
  ["#bae6fd", "#60a5fa", "#3730a3", "#150a33"],
  ["#fce7f3", "#f472b6", "#db2777", "#3b0d47"],
  ["#fef3c7", "#f59e0b", "#b91c1c", "#1a0a18"],
  ["#d9f99d", "#22c55e", "#15803d", "#0b2418"],
  ["#fed7aa", "#fb923c", "#b45309", "#2b1008"],
  ["#fee2f5", "#f472b6", "#a21caf", "#2c0a38"],
  ["#fde68a", "#d97706", "#7c2d12", "#1a0b0b"],
  ["#fecaca", "#ef4444", "#7f1d1d", "#140812"],
] as const;

function palette(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length]!;
}

export function GameArt({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} className={cn("h-full w-full object-cover object-[50%_30%]", className)} />;
  }
  const [a, b, c, d] = palette(name);
  return (
    // no text on the art: the card's caption already names the game (the design's gradients carry none either)
    <div aria-hidden className={cn("h-full w-full", className)} style={{ background: `radial-gradient(90% 70% at 50% 24%, ${a} 0%, ${b} 28%, ${c} 58%, ${d} 100%), radial-gradient(40% 30% at 22% 18%, rgba(255,255,255,.3), transparent 70%)`, backgroundBlendMode: "screen" }} />
  );
}
