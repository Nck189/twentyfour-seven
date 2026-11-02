/*
 * QA_QC §4.2 art lint over components/art/**.tsx — fails on:
 * black/near-black strokes, strokes > 1.5px, color literals that aren't tokens,
 * drop-shadow/box-shadow/blur, gradients outside sky components, SVGs without viewBox, baked-in text.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ART_DIR = "components/art";
const tokensCss = readFileSync("styles/tokens.css", "utf8");
const tokenNames = new Set([...tokensCss.matchAll(/--((?:art|sky)-[\w-]+)\s*:/g)].map((m) => m[1]));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) ? [p] : [];
  });
}

export function lintSource(file: string, src: string): string[] {
  const out: string[] = [];
  const isSky = /sky/i.test(file);
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (/\/\/|^\s*\*/.test(line.trim().slice(0, 2))) return; // comment lines
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g))
      out.push(`${at} color literal ${m[0]} (use a token from styles/tokens.css)`);
    for (const m of line.matchAll(/rgba?\([^)]*\)|hsla?\([^)]*\)/g)) out.push(`${at} color literal ${m[0]}`);
    for (const m of line.matchAll(/var\(--([\w-]+)\)/g)) {
      if ((m[1].startsWith("art-") || m[1].startsWith("sky-")) && !tokenNames.has(m[1]))
        out.push(`${at} unknown token --${m[1]}`);
      if (m[1].startsWith("ui-")) out.push(`${at} UI token --${m[1]} used in art`);
    }
    if (/stroke\s*=\s*["{]\s*["']?(black|#000|#111|#222)/i.test(line) || /stroke:\s*(black|#000)/i.test(line))
      out.push(`${at} black stroke`);
    const sw = line.match(/strokeWidth\s*=\s*\{?\s*["']?([\d.]+)/);
    if (sw && Number(sw[1]) > 1.5) out.push(`${at} stroke width ${sw[1]} > 1.5`);
    if (/drop-shadow|box-shadow|boxShadow|feGaussianBlur|blur\(/.test(line))
      out.push(`${at} shadow/blur is not allowed in flat art`);
    if (/<(linear|radial)Gradient/.test(line) && !isSky) out.push(`${at} gradient outside a sky component`);
    if (/<text\b/.test(line)) out.push(`${at} text baked into art`);
  });
  for (const m of src.matchAll(/<svg\b[^>]*>/g))
    if (!/viewBox=/.test(m[0])) out.push(`${file}: <svg> without viewBox`);
  return out;
}

const files = walk(ART_DIR);
const problems = files.flatMap((f) => lintSource(f, readFileSync(f, "utf8")));
if (problems.length) {
  console.error(`art lint failed (${problems.length}):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`art lint OK — ${files.length} art files, ${tokenNames.size} tokens`);
