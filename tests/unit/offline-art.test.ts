import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OFFLINE_ART, offlineArtSvg } from "../../scripts/gen-offline-art";

describe("offline page picture (G7 F4 S4-3)", () => {
  it("is the umbrella spot with today's tokens (run `npm run gen:offline-art` after changing either)", () => {
    const page = readFileSync("public/offline.html", "utf8");
    const svg = offlineArtSvg(readFileSync("styles/tokens.css", "utf8"));
    expect(page.match(OFFLINE_ART)?.[0]).toBe(svg);
    expect(svg).not.toMatch(/var\(--/);
  });
});
