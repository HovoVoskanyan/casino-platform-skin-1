import { centreAngle, labelLayout, restingRotation, segmentAtPointer, sliceAngle, sliceColors, targetRotation } from "./geometry";

const mod = (x: number, m: number) => ((x % m) + m) % m;

/** How far inside its slice the pointer is at `rotation` (0 = on an edge, 0.5 = dead centre), as a share of the slice. */
function depthInSlice(rotation: number, count: number) {
  const a = sliceAngle(count);
  const within = mod(mod(-rotation, 360), a) / a;
  return Math.min(within, 1 - within);
}

describe("the wheel's angle maths", () => {
  const counts = Array.from({ length: 15 }, (_, i) => i + 2); // 2…16 slices
  const starts = [0, 123.4, 7200 + 77, -50, 359.999];
  const jitters = [-1, -0.5, 0, 0.5, 1];

  it.each(counts)("lands the pointer inside the chosen slice, away from its edges, on a %i-slice wheel", (count) => {
    for (let index = 0; index < count; index++) {
      for (const from of starts) {
        for (const jitter of jitters) {
          const r = targetRotation(from, index, count, { turns: 5, jitter });
          expect(segmentAtPointer(r, count)).toBe(index);
          expect(depthInSlice(r, count)).toBeGreaterThan(0.1); // never on a line
        }
      }
    }
  });

  it("accumulates from the current rotation: always forward, the full turns plus less than one more", () => {
    for (const count of counts) {
      for (const from of starts) {
        const r = targetRotation(from, count - 1, count, { turns: 6, jitter: 0.3 });
        expect(r - from).toBeGreaterThanOrEqual(6 * 360);
        expect(r - from).toBeLessThan(7 * 360);
      }
    }
    // landing again from where the last spin stopped keeps going the same way
    const first = targetRotation(0, 2, 8, { turns: 5 });
    const second = targetRotation(first, 5, 8, { turns: 5 });
    expect(second).toBeGreaterThan(first + 5 * 360);
    expect(segmentAtPointer(second, 8)).toBe(5);
  });

  it("with no jitter lands on the slice's exact centre; zero turns (reduced motion) goes straight there", () => {
    const r = targetRotation(0, 3, 8, { turns: 0 });
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(360);
    expect(mod(-r, 360)).toBeCloseTo(centreAngle(3, 8), 6);
  });

  it("rests on a slice's centre (a reload after today's spin)", () => {
    for (const count of counts) {
      for (let index = 0; index < count; index++) {
        const r = restingRotation(index, count);
        expect(segmentAtPointer(r, count)).toBe(index);
        expect(depthInSlice(r, count)).toBeCloseTo(0.5, 6);
      }
    }
  });
});

describe("slice colours and labels", () => {
  it("never puts the same design colour side by side, also where the circle closes", () => {
    for (let count = 2; count <= 16; count++) {
      const colors = sliceColors(Array.from({ length: count }, () => ({ color: null })));
      colors.forEach((c, i) => expect(c).not.toBe(colors[(i + 1) % count]));
    }
  });

  it("uses the operator's #rrggbb and ignores anything else", () => {
    expect(sliceColors([{ color: "#12AB34" }, { color: "red" }, { color: null }])).toEqual(["#12ab34", "#f0a30a", "#4c1d95"]);
  });

  it("fits a label inside the radius: shrinks, wraps on wide slices, and cuts with an ellipsis on the narrowest", () => {
    const wide = labelLayout("10 Free Spins", 6);
    expect(wide.lines).toEqual(["10 Free", "Spins"]);
    const narrow = labelLayout("₱1,000 bonus", 16);
    expect(narrow.lines).toHaveLength(1);
    expect(narrow.fontSize).toBeGreaterThanOrEqual(7.5);
    const long = labelLayout("Super mega jackpot bonus of the week", 16);
    expect(long.lines[0]!.endsWith("…")).toBe(true);
    for (const l of [wide, narrow, long]) {
      for (const line of l.lines) expect(line.length * 0.6 * l.fontSize).toBeLessThanOrEqual(62.5);
    }
  });
});
