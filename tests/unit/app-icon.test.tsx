import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppIcon } from "@/components/art/AppIcon";

describe("app mark (G7 R-A-3)", () => {
  it("two marks on one page never share SVG ids (a hidden copy can't blank a visible one)", () => {
    const html = renderToStaticMarkup(
      <div>
        <AppIcon />
        <AppIcon />
      </div>,
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    // Every url(#…) points at an id that exists.
    for (const m of html.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(m[1]);
  });
});
