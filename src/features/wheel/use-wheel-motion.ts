import { useEffect, useMemo, useRef } from "react";
import { restingRotation, targetRotation } from "./geometry";

/** The design's spin: 3.6 s on its own ease-out curve. */
export const SPIN_MS = 3600;
export const SPIN_EASING = "cubic-bezier(.16,.84,.15,1)";
const FULL_TURNS = 6;
/** While bonus answers: a soft spin that eases up to this speed (degrees per ms — one turn a second). */
const WAIT_SPEED = 0.36;
const WAIT_RAMP_MS = 600;

export const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export interface WheelMotion {
  /** Put on the element that turns. */
  rotor: React.RefObject<HTMLDivElement | null>;
  /** Show slice `index` under the pointer, no animation. */
  rest: (index: number, count: number) => void;
  /** The soft spin while waiting for the server (none under reduced motion). */
  startWaiting: () => void;
  /** Spin onto slice `index` (several turns, the design's easing); resolves when it has stopped. */
  land: (index: number, count: number) => Promise<void>;
  /** The wait ended without a spin: glide to a stop where it is. */
  coast: () => void;
}

/**
 * The wheel's rotation, driven straight on the element (a frame-by-frame wait spin must not re-render React). The
 * rotation only ever grows, so the wheel never runs backwards; landing starts from wherever the wait spin got to.
 * Under prefers-reduced-motion there is no wait spin and the landing is a jump (the stylesheet drops transitions too).
 */
export function useWheelMotion(): WheelMotion {
  const rotor = useRef<HTMLDivElement | null>(null);
  const angle = useRef(0);
  const frame = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const motion = useMemo(() => {
    const apply = (deg: number, transition: string) => {
      const el = rotor.current;
      if (!el) return;
      el.style.transition = transition;
      el.style.transform = `rotate(${deg}deg)`;
    };
    const stopWaiting = () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    const clearTimer = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    return {
      rest(index: number, count: number) {
        stopWaiting();
        clearTimer();
        angle.current = restingRotation(Math.max(0, index), count);
        apply(angle.current, "none");
      },
      startWaiting() {
        stopWaiting();
        if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") return;
        const start = performance.now();
        let last = start;
        const step = (now: number) => {
          const speed = WAIT_SPEED * Math.min(1, (now - start) / WAIT_RAMP_MS);
          angle.current += speed * Math.max(0, now - last);
          last = now;
          apply(angle.current, "none");
          frame.current = requestAnimationFrame(step);
        };
        frame.current = requestAnimationFrame(step);
      },
      land(index: number, count: number) {
        stopWaiting();
        clearTimer();
        const reduced = prefersReducedMotion();
        angle.current = targetRotation(angle.current, Math.max(0, index), count, { turns: reduced ? 0 : FULL_TURNS, jitter: Math.random() * 2 - 1 });
        apply(angle.current, reduced ? "none" : `transform ${SPIN_MS}ms ${SPIN_EASING}`);
        return new Promise<void>((resolve) => {
          timer.current = window.setTimeout(() => {
            timer.current = null;
            resolve();
          }, reduced ? 0 : SPIN_MS + 80);
        });
      },
      coast() {
        const waiting = frame.current !== null;
        stopWaiting();
        if (!waiting) return;
        angle.current += 60;
        apply(angle.current, "transform 700ms cubic-bezier(.2,.7,.3,1)");
      },
      dispose() {
        stopWaiting();
        clearTimer();
      },
    };
  }, []);

  useEffect(() => () => motion.dispose(), [motion]);

  return useMemo(() => ({ rotor, rest: motion.rest, startWaiting: motion.startWaiting, land: motion.land, coast: motion.coast }), [motion]);
}
