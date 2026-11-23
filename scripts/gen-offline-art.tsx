/*
 * The offline page (public/offline.html) is static HTML served by the service worker, so it can't
 * use React or CSS tokens. Its picture is SpotArt "umbrella" with the tokens resolved to their
 * light-theme hex values. `npm run gen:offline-art` rewrites it; tests/unit/offline-art.test.ts
 * fails if the page and the component drift apart (G7 F4 S4-3).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { SpotArt } from "../components/art/Spots";

export function offlineArtSvg(tokensCss: string): string {
  const root = tokensCss.slice(0, tokensCss.indexOf("}") + 1);
  const tokens = new Map([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1], m[2]]));
  return (
    renderToStaticMarkup(<SpotArt kind="umbrella" className="" />)
      .replace(/var\(--([\w-]+)\)/g, (_, name: string) => {
        const hex = tokens.get(name);
        if (!hex) throw new Error(`unknown token --${name}`);
        return hex;
      })
      // A context variable with a fallback (the plot's --shadow-on) isn't set here: use the fallback.
      .replace(/var\(--[\w-]+,\s*(#[0-9a-fA-F]{3,8})\)/g, "$1")
      .replace(' class=""', ' width="144" height="96"')
  );
}

export const OFFLINE_ART = /<svg viewBox="0 0 96 64"[^\n]*<\/svg>/;

if (process.argv[1]?.endsWith("gen-offline-art.tsx")) {
  const page = "public/offline.html";
  const svg = offlineArtSvg(readFileSync("styles/tokens.css", "utf8"));
  writeFileSync(page, readFileSync(page, "utf8").replace(OFFLINE_ART, svg));
}
