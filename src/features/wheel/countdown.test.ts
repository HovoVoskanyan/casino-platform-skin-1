import { act, renderHook } from "@testing-library/react";
import i18n from "@/i18n";
import { formatCountdown, useCountdown } from "./countdown";
import { resultCopy, zoneCity } from "./copy";
import type { WheelSpin } from "./api";

describe("the countdown", () => {
  it.each([
    [0, "00:00:00"],
    [-5_000, "00:00:00"],
    [1, "00:00:01"],
    [999, "00:00:01"],
    [59_000, "00:00:59"],
    [3_600_000, "01:00:00"],
    [3 * 3_600_000 + 25 * 60_000 + 10_000, "03:25:10"],
    [48 * 3_600_000 - 1_000, "47:59:59"],
  ])("formats %i ms as %s", (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });

  afterEach(() => vi.useRealTimers());

  it("counts on the server's clock and fires once when it is due", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const now = Date.now();
    // the phone runs an hour fast: the server says it is an hour earlier, so 2h on the server's clock is 2h left
    const offset = -3_600_000;
    const target = now + offset + 2_000;
    const { result } = renderHook(() => useCountdown(target, offset, onExpire));
    expect(result.current).toBe(2_000);

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(1_000);
    expect(onExpire).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1_500));
    expect(result.current).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1); // once per target, not every tick
  });

  it("has nothing to count without a target", () => {
    const { result } = renderHook(() => useCountdown(null, 0));
    expect(result.current).toBeNull();
  });
});

describe("the result's words", () => {
  const t = i18n.t.bind(i18n);
  const spin = (over: Partial<WheelSpin>): WheelSpin => ({
    spinId: "s", segmentId: "g", segmentPosition: 0, label: "₱500 Bonus", prizeType: "bonusMoney", outcome: "granted", currency: "PHP",
    amountCents: 50_000, freeSpinsCount: null, spinDay: "2026-10-15", spunAt: "2026-10-15T01:00:00Z", nextSpinAt: "2026-10-15T16:00:00Z",
    replayed: false, proof: { seed: "x", roll: 1, totalWeight: 2, eligibleWeights: "" }, ...over,
  });

  it("says what was won and where it is, and never an internal reason", () => {
    expect(resultCopy(t, spin({}))).toMatchObject({ tone: "win", headline: "You won ₱500 bonus!", link: "bonuses" });
    expect(resultCopy(t, spin({ prizeType: "freeSpins", amountCents: null, freeSpinsCount: 1 })).headline).toBe("You won 1 free spin!");
    expect(resultCopy(t, spin({ prizeType: "freeSpins", amountCents: null, freeSpinsCount: 20 })).headline).toBe("You won 20 free spins!");
    expect(resultCopy(t, spin({ prizeType: "noPrize", outcome: "noPrize", amountCents: null }))).toMatchObject({ tone: "none", headline: "No luck today", link: null });
    expect(resultCopy(t, spin({ outcome: "pending" }))).toMatchObject({ tone: "pending", headline: "You won ₱500 bonus!", body: "We’re adding it to your account — it will show up in a moment." });
    expect(resultCopy(t, spin({ outcome: "failed" }))).toMatchObject({ tone: "failed", headline: "You won ₱500 bonus!", link: "support" });
  });

  it("names the wheel's time zone by its city", () => {
    expect(zoneCity("Asia/Manila")).toBe("Manila");
    expect(zoneCity("America/Los_Angeles")).toBe("Los Angeles");
    expect(zoneCity(null)).toBeNull();
  });
});
