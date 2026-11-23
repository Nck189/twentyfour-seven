/*
 * Renders the app icon (components/art/AppIcon.tsx) into every file the browser, the PWA manifest
 * and iOS need, plus the link-preview card (review fix A3). The art is the one React component,
 * so the icon in the app and the files never drift. Run: npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { AppIconArt } from "@/components/art/AppIcon";
import { CropArt } from "@/components/art/farm/CropArt";
import { Farmhouse } from "@/components/art/farm/Farmhouse";

const css = readFileSync("styles/tokens.css", "utf8");
const root = css.slice(0, css.indexOf("@media"));
const tokens = new Map([...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
const VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*?))?\s*\)/;
/** Inlines the light tokens (innermost var first), as lib/share/cardPicture.ts does in the browser. */
function inline(markup: string): string {
  let out = markup;
  for (let m = VAR.exec(out); m; m = VAR.exec(out))
    out =
      out.slice(0, m.index) +
      (tokens.get(m[1]!) || m[2]?.trim() || "transparent") +
      out.slice(m.index + m[0].length);
  return out;
}
const svg = (inner: string, attrs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" ${attrs}>${inner}</svg>`;
/** The icon's shapes (rendered inside an <svg>, so React treats them as SVG; the wrapper is dropped). */
const art = (safe = false) =>
  inline(renderToStaticMarkup(createElement("svg", null, createElement(AppIconArt, { safe }))))
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
const piece = (el: ReturnType<typeof createElement>, px: number) =>
  inline(renderToStaticMarkup(el)).replace("<svg", `<svg width="${px}" height="${px}"`);

async function main() {
  mkdirSync("public/icons", { recursive: true });
  // Browser tab icon: rounded, vector.
  writeFileSync(
    "app/icon.svg",
    svg(
      `<clipPath id="r"><rect width="64" height="64" rx="15"/></clipPath><g clip-path="url(#r)">${art()}</g>`,
    ) + "\n",
  );
  // PW_CHROMIUM: a Chromium binary to use when the pinned Playwright browser isn't installed.
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const shoot = async (file: string, w: number, h: number, html: string, transparent = false) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(
      `<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden">${html}</body></html>`,
    );
    await page.screenshot({ path: file, omitBackground: transparent });
    await page.close();
  };
  const full = svg(art(), 'width="100%" height="100%" style="display:block"');
  const rounded = svg(
    `<clipPath id="r"><rect width="64" height="64" rx="15"/></clipPath><g clip-path="url(#r)">${art()}</g>`,
    'width="100%" height="100%" style="display:block"',
  );
  // iOS and maskable icons are full-bleed (the OS cuts the shape); maskable keeps the art in the safe middle.
  await shoot("app/apple-icon.png", 180, 180, full);
  await shoot("public/icons/icon-192.png", 192, 192, rounded, true);
  await shoot("public/icons/icon-512.png", 512, 512, rounded, true);
  await shoot(
    "public/icons/icon-maskable-512.png",
    512,
    512,
    svg(art(true), 'width="100%" height="100%" style="display:block"'),
  );

  // Link preview (LINE, IG, iMessage): 1200 × 630. Som's icon large, the name, one line, a few crops.
  const c = (n: string) => tokens.get(n)!;
  const crops = (["strawberry", "radish", "corn", "carrot"] as const)
    .map((id) => piece(createElement(CropArt, { cropId: id, stage: 3, status: "ready", className: "" }), 120))
    .join("");
  const og = `
    <div style="width:1200px;height:630px;position:relative;font-family:Nunito,'Arial Rounded MT Bold',Arial,sans-serif;
      background:linear-gradient(${c("--sky-sunrise-top")},${c("--sky-sunrise-bottom")});color:${c("--ui-text")}">
      <div style="position:absolute;left:0;right:0;bottom:0;height:120px;background:${c("--art-leaf-2")};border-radius:60px 60px 0 0"></div>
      <div style="position:absolute;left:90px;top:112px;width:400px;height:400px;border-radius:90px 90px 0 0;overflow:hidden">${full}</div>
      <div style="position:absolute;left:560px;top:150px;font-size:150px;font-weight:900;line-height:1">24/7</div>
      <div style="position:absolute;left:566px;top:318px;font-size:44px;font-weight:800;line-height:1.25;width:560px">
        Your day in 7 blocks.<br>Live them, and your farm grows.</div>
      <div style="position:absolute;left:556px;bottom:62px;display:flex;gap:6px">${crops}
        ${piece(createElement(Farmhouse, { level: 1, className: "" }), 120)}</div>
    </div>`;
  await shoot("app/opengraph-image.png", 1200, 630, og);
  await shoot("app/twitter-image.png", 1200, 630, og);
  await browser.close();
}
void main();
