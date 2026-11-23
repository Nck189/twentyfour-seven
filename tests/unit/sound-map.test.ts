import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { C_MAJOR, RECIPES, shopSound } from "@/lib/sound/recipes";

/** Review fix F1: one set of sounds, all mapped, all used. */
const ROOT = join(__dirname, "../..");
const map = readFileSync(join(ROOT, "docs/SOUND-MAP.md"), "utf8");
const mapped = new Set([...map.matchAll(/`sfx\.(\w+)`/g)].map((m) => m[1]!));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" ? [] : files(p);
    return /\.(tsx?|ts)$/.test(f) ? [p] : [];
  });
}
const source = ["app", "components", "lib"]
  .flatMap((d) => files(join(ROOT, d)))
  .filter((p) => !p.endsWith("lib/sound/sfx.ts") && !p.endsWith("lib/sound/recipes.ts"))
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");
const sfxSource = readFileSync(join(ROOT, "lib/sound/sfx.ts"), "utf8");
const sfxNames = [...sfxSource.matchAll(/^ {2}(\w+): /gm)].map((m) => m[1]!);

describe("sound map (docs/SOUND-MAP.md)", () => {
  it("lists every sound sfx has", () => {
    expect(sfxNames.length).toBeGreaterThan(15);
    for (const n of sfxNames) expect(mapped, `sfx.${n} is not in the sound map`).toContain(n);
  });
  it("every mapped sound is played somewhere", () => {
    for (const n of mapped) {
      expect(sfxNames, `sfx.${n} doesn't exist`).toContain(n);
      expect(source, `sfx.${n} is never called`).toMatch(new RegExp(`sfx\\.${n}\\b`));
    }
  });
});

describe("the new sounds are one set", () => {
  const all = [
    ...Object.entries(RECIPES).flatMap(([name, r]) =>
      name === "grow"
        ? (r as (n: number) => unknown[])(7)
        : name === "blockDone"
          ? (r as (a: boolean) => unknown[])(true)
          : (r as () => unknown[])(),
    ),
    ...RECIPES.celebrate(2),
  ] as { freq: number; to?: number; at: number; dur: number; gain?: number }[];
  it("in C major, short and soft", () => {
    for (const n of all) {
      expect(C_MAJOR).toContain(n.freq);
      if (n.to) expect(C_MAJOR).toContain(n.to);
      expect(n.at + n.dur).toBeLessThanOrEqual(1);
      expect(n.gain ?? 0.2).toBeLessThanOrEqual(0.2);
    }
  });
  it("finishing every item adds a note; a bigger celebration ends higher", () => {
    expect(RECIPES.blockDone(true)).toHaveLength(RECIPES.blockDone(false).length + 1);
    expect(RECIPES.celebrate(2).at(-1)!.freq).toBeGreaterThan(RECIPES.celebrate(0).at(-1)!.freq);
    expect(RECIPES.grow(0)).toEqual([]);
    expect(RECIPES.grow(99)).toHaveLength(7);
  });
  it("the shop picks a sound per action", () => {
    expect(shopSound("order-2")).toBe("deliver");
    expect(shopSound("order-seasonal")).toBe("deliver");
    expect(shopSound("seed-tomato")).toBe("buy");
    expect(shopSound("up-farmhouse")).toBe("buy");
    expect(shopSound("exchange")).toBe("buy");
    expect(shopSound("redeem-x")).toBe("buy");
    expect(shopSound("sellall-tomato")).toBe("coin");
    expect(shopSound("rm-x")).toBe("tick");
  });
});
