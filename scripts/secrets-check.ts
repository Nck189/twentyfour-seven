/* G5: no secrets tracked in git, and .env files are not tracked. */
import { execSync } from "node:child_process";

const problems: string[] = [];
let tracked: string[] = [];
try {
  tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  console.log("secrets check skipped (not a git repo yet)");
  process.exit(0);
}
for (const f of tracked)
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".env.example")) problems.push(`tracked env file: ${f}`);

const patterns = [
  "sbp_[a-zA-Z0-9]{20,}", // Supabase personal access token
  "sb_secret_[a-zA-Z0-9_-]{20,}", // Supabase secret key
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6", // hosted project JWT
  'service_role"\\s*:\\s*"ey',
  "-----BEGIN (RSA |EC )?PRIVATE KEY-----",
  "gh[pousr]_[A-Za-z0-9]{30,}",
];
for (const p of patterns) {
  try {
    const out = execSync(`git grep -nIE '${p}' -- . ':!package-lock.json'`, { encoding: "utf8" });
    if (out.trim()) problems.push(`possible secret (${p}):\n${out}`);
  } catch {
    // git grep exits 1 when nothing matches
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`secrets OK — ${tracked.length} tracked files scanned`);
