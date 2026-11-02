import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Minnie: never use Apple/Android/vendor emoji (they look rushed and off-style). Icons are
 * hand-built SVG (components/ui/Icons.tsx, components/art). This guards UI code and strings.
 */
// Emoji (Extended_Pictographic) and check/cross marks that iOS may draw as emoji. Plain
// typography like "→" is fine.
const EMOJI = /[\p{Extended_Pictographic}\u{2713}\u{2714}\u{2715}\u{2716}\u{2717}\u{2718}\u{FE0F}]/u;
const ROOTS = ["app", "components", "messages", "content", "public/offline.html"];

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

describe("no emoji in the UI", () => {
  it("app, components, messages and content contain no emoji or symbol glyphs", () => {
    const hits: string[] = [];
    for (const f of ROOTS.flatMap(files).filter((f) => /\.(tsx?|json|html)$/.test(f))) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (EMOJI.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
