/*
 * G1 i18n gate: EN and TH dictionaries must have identical key sets with non-empty values,
 * and every t("key") used in code must exist. Run: npx tsx scripts/i18n-check.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

type Dict = { [k: string]: string | Dict };

function flatten(d: Dict, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const en = flatten(JSON.parse(readFileSync("messages/en.json", "utf8")));
const th = flatten(JSON.parse(readFileSync("messages/th.json", "utf8")));
const problems: string[] = [];

for (const k of en.keys()) if (!th.has(k)) problems.push(`missing in th: ${k}`);
for (const k of th.keys()) if (!en.has(k)) problems.push(`missing in en: ${k}`);
for (const [k, v] of [...en, ...th]) if (!v.trim()) problems.push(`empty value: ${k}`);

// Static usage check: useTranslations("ns") + t("key") within the same file.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" ? [] : walk(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}
for (const file of [...walk("app"), ...walk("components")]) {
  const src = readFileSync(file, "utf8");
  const ns = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*"([\w.]+)"\s*\)/g)];
  for (const [, varName, namespace] of ns) {
    const re = new RegExp(`\\b${varName}\\(\\s*"([\\w.]+)"`, "g");
    for (const [, key] of src.matchAll(re)) {
      if (!en.has(`${namespace}.${key}`)) problems.push(`${file}: unknown key ${namespace}.${key}`);
    }
  }
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`i18n OK — ${en.size} keys in en/th`);
