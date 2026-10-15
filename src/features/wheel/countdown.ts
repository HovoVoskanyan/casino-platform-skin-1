import { useEffect, useRef, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "HH:MM:SS" for a span of milliseconds, rounded UP to the second (it reads 00:00:01 until the moment it is due, then
 * 00:00:00). Hours are not wrapped at 24: a wheel closed tomorrow and the day after counts down from 47:…
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/**
 * What is left until `target` (epoch ms) on the SERVER's clock (`offsetMs` = server − phone, measured when the wheel
 * was read), ticking twice a second; null without a target. `onExpire` runs once per target when it is reached.
 */
export function useCountdown(target: number | null, offsetMs: number, onExpire?: () => void): number | null {
  const [now, setNow] = useState(() => Date.now());
  const expire = useRef(onExpire);
  const fired = useRef<number | null>(null);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    if (target === null) return;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      if (target - (at + offsetMs) <= 0 && fired.current !== target) {
        fired.current = target;
        expire.current?.();
      }
    };
    const id = window.setInterval(tick, 500);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [target, offsetMs]);

  return target === null ? null : Math.max(0, target - (now + offsetMs));
}
