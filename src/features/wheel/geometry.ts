/**
 * The Lucky Wheel's geometry, as pure functions (tested on their own). Angles are degrees, CLOCKWISE from 12
 * o'clock — where the pointer is. Slice `i` (the server's `position`, 0-based, clockwise from the pointer) spans
 * [i·a, (i+1)·a) with a = 360 / count when the wheel is at rotation 0. Rotating the wheel by R (CSS rotate, clockwise)
 * moves a point at wheel angle θ to θ + R, so the pointer reads the wheel angle −R.
 */

const mod = (x: number, m: number) => ((x % m) + m) % m;

export const sliceAngle = (count: number) => 360 / Math.max(1, count);

/** The middle of slice `index`, at rotation 0. */
export const centreAngle = (index: number, count: number) => (index + 0.5) * sliceAngle(count);

/** How far from the slice's centre a landing may stray, as a share of the slice: well inside its edges. */
export const JITTER_SHARE = 0.35;

/**
 * The rotation that puts the pointer on slice `index`: its centre, moved by `jitter` (−1…1) × 35% of the slice so
 * every landing looks a little different but never sits on a line. It ACCUMULATES from `from` (the wheel never
 * spins backwards or snaps): at least `turns` full turns more, then forward to the slice.
 */
export function targetRotation(from: number, index: number, count: number, { turns = 5, jitter = 0 }: { turns?: number; jitter?: number } = {}): number {
  const a = sliceAngle(count);
  const j = Math.max(-1, Math.min(1, jitter));
  const wanted = mod(-(centreAngle(index, count) + j * JITTER_SHARE * a), 360);
  const forward = mod(wanted - mod(from, 360), 360);
  return from + Math.max(0, Math.floor(turns)) * 360 + forward;
}

/** The rotation that shows slice `index` under the pointer, at rest (a reload after today's spin). */
export const restingRotation = (index: number, count: number) => mod(-centreAngle(index, count), 360);

/** Which slice the pointer is on at `rotation`. */
export function segmentAtPointer(rotation: number, count: number): number {
  return Math.floor(mod(-rotation, 360) / sliceAngle(count)) % count;
}

/** A point on the wheel (centre 0,0; y down) at `angle` clockwise from 12 o'clock and radius `r`. */
function point(angle: number, r: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The SVG path of slice `index` on a wheel of radius `r`. */
export function slicePath(index: number, count: number, r: number): string {
  if (count <= 1) return `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 Z`;
  const a = sliceAngle(count);
  const [x1, y1] = point(index * a, r);
  const [x2, y2] = point((index + 1) * a, r);
  return `M 0 0 L ${round(x1)} ${round(y1)} A ${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${round(x2)} ${round(y2)} Z`;
}

/** The design's slice colours, in order (Home's wheel: violet, amber, deep violet, light gold). */
export const PALETTE = ["#6d28a8", "#f0a30a", "#4c1d95", "#ffd766"] as const;

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Each slice's fill: the operator's colour when it is a proper #rrggbb, else the design's cycle — never the same
 * colour twice side by side, also where the circle closes (an odd count would put two violets together).
 */
export function sliceColors(segments: { color?: string | null }[]): string[] {
  const out: string[] = [];
  segments.forEach((s, i) => {
    if (s.color && HEX.test(s.color)) {
      out.push(s.color.toLowerCase());
      return;
    }
    const prev = out[i - 1];
    const first = i === segments.length - 1 && i > 0 ? out[0] : undefined;
    const cycle = PALETTE[i % PALETTE.length]!;
    const pick = cycle !== prev && cycle !== first ? cycle : PALETTE.find((c) => c !== prev && c !== first) ?? cycle;
    out.push(pick);
  });
  return out;
}

/** Dark ink on the light golds, white on the violets (relative luminance, WCAG's formula). */
export function inkFor(hex: string): string {
  const v = HEX.test(hex) ? hex : "#6d28a8";
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? "#2c1400" : "#ffffff";
}

/** Where a label sits along the radius (wheel radius 100): from just outside the hub to just inside the rim. */
export const LABEL_INNER = 33;
export const LABEL_OUTER = 95;
const LABEL_LENGTH = LABEL_OUTER - LABEL_INNER;
const CHAR = 0.6; // average width of a Manrope 800 glyph, in ems
const MIN_SIZE = 7.5;
const MAX_SIZE = 14;

export interface LabelLayout {
  lines: string[];
  /** In wheel units (the wheel is 200 across): ~1px at 320px wide, ~1.4px at 280px. */
  fontSize: number;
}

/**
 * A slice's label, written along the radius: one line as large as the slice allows (capped), two lines when the
 * slice is wide enough and that is bigger, else shrunk to the floor and cut with an ellipsis. Never wider than its
 * slice, never longer than the radius — readable on a 320px phone with 16 slices.
 */
export function labelLayout(label: string, count: number): LabelLayout {
  const text = label.trim().replace(/\s+/g, " ") || "?";
  const half = (sliceAngle(count) * Math.PI) / 360;
  // the slice's width where a full-length label is narrowest: its inner end, next to the hub
  const width = 2 * LABEL_INNER * Math.sin(Math.min(half, Math.PI / 2));
  const capOne = Math.min(MAX_SIZE, width * 0.85);
  const fits = (s: string) => LABEL_LENGTH / (CHAR * Math.max(1, s.length));

  const one = Math.min(capOne, fits(text));
  if (one >= 10 || !text.includes(" ")) return finish([text], one);

  // two lines: break at the space nearest the middle
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index!);
  const at = spaces.reduce((best, i) => (Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best), spaces[0]!);
  const lines = [text.slice(0, at), text.slice(at + 1)];
  const two = Math.min(MAX_SIZE, width / 2.3, ...lines.map(fits));
  return two > one ? finish(lines, two) : finish([text], one);
}

function finish(lines: string[], size: number): LabelLayout {
  const fontSize = Math.max(MIN_SIZE, Math.floor(size * 10) / 10);
  const max = Math.floor(LABEL_LENGTH / (CHAR * fontSize) + 0.05);
  return { lines: lines.map((l) => (l.length > max ? `${l.slice(0, Math.max(1, max - 1)).trimEnd()}…` : l)), fontSize };
}
