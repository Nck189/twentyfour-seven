import { describe, expect, it } from "vitest";
import { GENERIC_FARM, buildSnapshot } from "@/lib/share/farmSnapshot";
import { CARD, FOOTER, fitFont, layoutScene } from "@/lib/share/cardPicture";
import { qrBox } from "@/lib/share/qr";

describe("her own farm on shared pictures (review fix A4)", () => {
  it("picks up to 3 different crops, rarest first, and up to 2 animals, newest first", () => {
    const s = buildSnapshot(
      [
        { crop_id: "radish" },
        { crop_id: "radish" },
        { crop_id: "strawberry" },
        { crop_id: "rainbow_corn" },
        { crop_id: "corn" },
        { crop_id: null },
        { crop_id: "not-a-crop" },
      ],
      [
        { species: "chicken", created_at: "2026-11-01T00:00:00Z" },
        { species: "cat", created_at: "2026-11-10T00:00:00Z" },
        { species: "cow", created_at: "2026-11-05T00:00:00Z" },
        { species: "dragon", created_at: "2026-11-12T00:00:00Z" },
      ],
      2,
    );
    // Two animals leave room for two crops (four pieces at most).
    expect(s.crops).toHaveLength(2);
    expect(s.crops[0]).toBe("rainbow_corn");
    expect(new Set(s.crops).size).toBe(2);
    expect(
      buildSnapshot([{ crop_id: "radish" }, { crop_id: "corn" }, { crop_id: "carrot" }], [], 1).crops,
    ).toHaveLength(3);
    // Animals but nothing planted: the generic crops fill in.
    expect(buildSnapshot([], [{ species: "cat", created_at: "x" }], 1).crops).toEqual(GENERIC_FARM.crops);
    expect(s.animals).toEqual(["cat", "cow"]);
    expect(s.house).toBe(2);
  });

  it("an empty farm gets the generic scene; a farm with no house still shows one", () => {
    expect(buildSnapshot([], [], 0)).toEqual(GENERIC_FARM);
    expect(buildSnapshot([{ crop_id: "radish" }], [], 0).house).toBe(1);
  });

  it("holds nothing private: only crop ids, species and a house level", () => {
    const s = buildSnapshot([{ crop_id: "radish" }], [{ species: "cat", created_at: "x" }], 1);
    expect(Object.keys(s).sort()).toEqual(["animals", "crops", "house"]);
  });
});

describe("picture layout", () => {
  it("every piece stands on the ground and stays on the card, for 0 to 5 middle pieces", () => {
    for (let n = 0; n <= 5; n++) {
      const slots = layoutScene(Array.from({ length: n }, (_, i) => `m${i}`));
      for (const [slot, [x, y, size]] of Object.entries(slots)) {
        expect(Math.abs(y + size * (41 / 48) - 472), `${n}:${slot}`).toBeLessThanOrEqual(1);
        expect(x, `${n}:${slot}`).toBeGreaterThanOrEqual(0);
        expect(x + size, `${n}:${slot}`).toBeLessThanOrEqual(CARD.w);
      }
      expect(Object.keys(slots)).toHaveLength(n + 2); // + Som and the farmhouse
    }
  });

  it("the footer (address + QR) sits inside the card, below the ground line", () => {
    expect(FOOTER.x).toBeGreaterThanOrEqual(0);
    expect(FOOTER.x + FOOTER.w).toBeLessThanOrEqual(CARD.w);
    expect(FOOTER.y).toBeGreaterThan(484);
    expect(FOOTER.y + FOOTER.h).toBeLessThanOrEqual(CARD.h);
  });
});

describe("G7 review of Phase A", () => {
  it("R-A-11: two pieces stand at one third and two thirds, not at the far ends", () => {
    const s = layoutScene(["a", "b"]);
    const centre = (k: string) => s[k]![0] + s[k]![2] / 2;
    expect(centre("b") - centre("a")).toBeLessThan(120);
    expect(centre("a")).toBeGreaterThan(196);
  });

  it("R-A-1: QR modules are whole pixels, at least 3 logical px, with a 4-module quiet zone", () => {
    for (const n of [25, 33, 41, 45]) {
      const q = qrBox(n, 96);
      expect(Number.isInteger(q.cell)).toBe(true);
      expect(q.cell).toBeGreaterThanOrEqual(3);
      expect(q.size).toBe(q.cell * n);
      expect(q.margin).toBeGreaterThanOrEqual(4 * q.cell);
    }
  });

  it("R-A-4: a line wider than its box gets a smaller font, never squeezed letters", () => {
    const measure = (px: number) => px * 17; // a 340 px line at 20 px
    expect(fitFont(20, 266, measure)).toBeLessThanOrEqual(15.7);
    expect(fitFont(20, 266, (px) => px * 10)).toBe(20);
    expect(fitFont(20, 100, measure)).toBe(14); // floor: still readable
  });
});
