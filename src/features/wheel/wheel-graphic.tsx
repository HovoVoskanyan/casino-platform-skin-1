import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WheelSegment } from "./api";
import { centreAngle, inkFor, LABEL_INNER, LABEL_OUTER, labelLayout, sliceAngle, sliceColors, slicePath } from "./geometry";
import { prizeText } from "./copy";

const R = 100;

/**
 * Design (Home's Lucky Wheel): min(280px, 64vw) across with an 8px #ffc93c rim, the gold pointer at 12 o'clock and
 * the ChoCho tiger in a gold-ringed hub. The slices are the server's, in its order, clockwise from the pointer; their
 * labels run along the radius and shrink (or wrap, or are cut) to fit. A slice the player cannot land on now is
 * dimmed. The picture itself is hidden from screen readers — the list under it says the same in words.
 */
export function WheelGraphic({ segments, currency, rotorRef, className }: { segments: WheelSegment[]; currency: string | null | undefined; rotorRef?: Ref<HTMLDivElement>; className?: string }) {
  const { t } = useTranslation();
  const n = segments.length;
  const colors = sliceColors(segments);
  const a = sliceAngle(n);

  return (
    <div className={cn("relative aspect-square w-[min(280px,64vw)] flex-none short:w-[min(230px,52vh)]", className)}>
      <span aria-hidden className="pointer-events-none absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(255,201,60,.22)_0%,rgba(167,139,250,.12)_55%,transparent_72%)] blur-[6px]" />
      <div ref={rotorRef} aria-hidden data-testid="wheel-rotor" className="absolute inset-0 overflow-hidden rounded-full border-[8px] border-cc-gold bg-[#2c1050] shadow-[0_18px_40px_rgba(0,0,0,.55),inset_0_0_0_2px_rgba(44,20,0,.35)] will-change-transform">
        <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="block h-full w-full" focusable="false">
          {segments.map((s, i) => {
            const label = labelLayout(prizeText(t, s, currency), n);
            const fill = colors[i]!;
            const ink = s.eligible ? inkFor(fill) : "#d9cdef";
            const mid = (LABEL_INNER + LABEL_OUTER) / 2;
            const lineGap = label.fontSize * 1.08;
            return (
              <g key={s.id} data-slice={s.position} data-eligible={s.eligible ? "true" : "false"}>
                <path d={slicePath(i, n, R)} fill={fill} />
                {s.eligible ? null : <path d={slicePath(i, n, R)} fill="#0e061a" fillOpacity={0.62} />}
                <g transform={`rotate(${centreAngle(i, n)})`}>
                  <text
                    transform={`translate(0 ${-mid}) rotate(90)`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={ink}
                    fillOpacity={s.eligible ? 1 : 0.7}
                    fontSize={label.fontSize}
                    fontWeight={800}
                    letterSpacing={-0.2}
                    style={{ paintOrder: "stroke" }}
                    stroke={ink === "#ffffff" ? "rgba(20,6,40,.45)" : "none"}
                    strokeWidth={ink === "#ffffff" ? 1.2 : 0}
                  >
                    {label.lines.map((line, k) => (
                      <tspan key={k} x={0} y={(k - (label.lines.length - 1) / 2) * lineGap}>{line}</tspan>
                    ))}
                  </text>
                </g>
              </g>
            );
          })}
          {n > 1
            ? segments.map((s, i) => (
                <line key={`edge-${s.id}`} x1={0} y1={0} x2={0} y2={-R} transform={`rotate(${i * a})`} stroke="#2c1400" strokeOpacity={0.35} strokeWidth={0.8} />
              ))
            : null}
          {segments.map((s, i) => (
            <circle key={`stud-${s.id}`} cx={0} cy={-R + 3.2} r={1.6} transform={`rotate(${i * a})`} fill="#fff4cf" />
          ))}
        </svg>
      </div>
      {/* the pointer: the design's gold triangle over the rim at 12 o'clock */}
      <span aria-hidden className="absolute -top-[6px] left-1/2 z-[2] h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[20px] border-x-transparent border-t-cc-gold drop-shadow-[0_3px_4px_rgba(0,0,0,.6)]" />
      <span aria-hidden className="absolute top-1/2 left-1/2 z-[2] aspect-square w-[29%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-cc-gold bg-[#2c1050] shadow-[0_4px_14px_rgba(0,0,0,.55)]">
        <img src="/chocho-logo-cut.png" alt="" draggable={false} className="block w-[260%] max-w-none -mt-[42%] -ml-[44%] select-none" />
      </span>
    </div>
  );
}
