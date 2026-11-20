import { describe, expect, it } from "vitest";
import { qrMatrix } from "@/lib/share/qr";

const finder = (m: boolean[][], r0: number, c0: number) => {
  // 7×7: dark ring, light ring, dark 3×3 core.
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++) {
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      if (m[r0 + r]![c0 + c] !== (ring !== 2)) return false;
    }
  return true;
};

describe("QR for shared pictures (review fix A1)", () => {
  const m = qrMatrix("https://twentyfour-seven.vercel.app/?from=week");
  it("is a square matrix", () => {
    expect(m.length).toBeGreaterThanOrEqual(21);
    for (const row of m) expect(row).toHaveLength(m.length);
  });
  it("has the three finder patterns a camera looks for", () => {
    const n = m.length;
    expect(finder(m, 0, 0)).toBe(true);
    expect(finder(m, 0, n - 7)).toBe(true);
    expect(finder(m, n - 7, 0)).toBe(true);
  });
  it("differs for different text", () => {
    expect(qrMatrix("a")).not.toEqual(qrMatrix("b"));
  });
});
