/* Renders app/icon.svg into the PNG sizes the PWA manifest and iOS need. Run: npx tsx scripts/gen-icons.ts */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("app/icon.svg", "utf8");
const targets: { file: string; size: number; pad: number; bg: string }[] = [
  { file: "public/icons/icon-192.png", size: 192, pad: 0, bg: "transparent" },
  { file: "public/icons/icon-512.png", size: 512, pad: 0, bg: "transparent" },
  { file: "public/icons/icon-maskable-512.png", size: 512, pad: 0.12, bg: "#F3EFE4" },
  { file: "app/apple-icon.png", size: 180, pad: 0, bg: "#F3EFE4" },
];

async function main() {
  mkdirSync("public/icons", { recursive: true });
  const browser = await chromium.launch();
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
    const inner = Math.round(t.size * (1 - t.pad * 2));
    await page.setContent(
      `<html><body style="margin:0;background:${t.bg};display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`,
    );
    await page.screenshot({ path: t.file, omitBackground: t.bg === "transparent" });
    await page.close();
  }
  await browser.close();
}
main();
