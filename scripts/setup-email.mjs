#!/usr/bin/env node
/**
 * One-time prod setup for 6-digit sign-in codes (run on Minnie's Mac, in the project folder):
 *   node scripts/setup-email.mjs
 *
 * Sets, via the Supabase Management API (only these auth settings, nothing else):
 *   - custom SMTP through Gmail (the free plan only sends custom templates via your own SMTP)
 *   - the Magic Link + Confirm signup emails = supabase/templates/sign-in-code.html (the code only)
 *   - email OTP length = 6
 *
 * Asks for two secrets (typed, not shown, never saved or printed):
 *   - a Supabase access token: supabase.com/dashboard/account/tokens → Generate new token
 *   - a Gmail app password: myaccount.google.com/apppasswords
 * Delete the access token on that page afterwards if you like.
 */
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const SUBJECT = "รหัสเข้าสู่ระบบ 24/7 · Your 24/7 sign-in code";

function projectRef() {
  if (existsSync("supabase/.temp/project-ref"))
    return readFileSync("supabase/.temp/project-ref", "utf8").trim();
  if (existsSync(".env.local")) {
    const m = readFileSync(".env.local", "utf8").match(
      /NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?https:\/\/([a-z0-9]+)\.supabase\.co/,
    );
    if (m) return m[1];
  }
  return null;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const write = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (s) => write(s.startsWith(question) ? s : "");
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const ref = projectRef();
if (!ref) {
  console.error("Run this in the project folder (where supabase/.temp/project-ref or .env.local is).");
  process.exit(1);
}
const html = readFileSync("supabase/templates/sign-in-code.html", "utf8");
if (!html.includes("{{ .Token }}")) {
  console.error("supabase/templates/sign-in-code.html has no {{ .Token }} — stopping.");
  process.exit(1);
}

console.log(`Project: ${ref}\n`);
const token = await ask("Supabase access token (hidden): ", { hidden: true });
const gmail = await ask("Your Gmail address: ");
const appPassword = (await ask("Gmail app password, 16 letters (hidden): ", { hidden: true })).replace(
  /\s+/g,
  "",
);
if (!token || !/^[^@\s]+@gmail\.com$/i.test(gmail) || appPassword.length !== 16) {
  console.error(
    "\nSomething looks off (token empty, not a @gmail.com address, or the app password isn't 16 letters). Nothing changed.",
  );
  process.exit(1);
}

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const body = {
  external_email_enabled: true,
  smtp_admin_email: gmail,
  smtp_host: "smtp.gmail.com",
  smtp_port: "587",
  smtp_user: gmail,
  smtp_pass: appPassword,
  smtp_sender_name: "24/7",
  mailer_otp_length: 6,
  mailer_subjects_magic_link: SUBJECT,
  mailer_templates_magic_link_content: html,
  mailer_subjects_confirmation: SUBJECT,
  mailer_templates_confirmation_content: html,
};

const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(body) });
if (!res.ok) {
  const text = (await res.text()).slice(0, 300);
  console.error(`\nSupabase said ${res.status}. Nothing may have changed.\n${text}`);
  if (res.status === 401)
    console.error("→ The access token was wrong or expired: make a new one and run this again.");
  process.exit(1);
}

// Read back what matters (no secrets printed).
const now = await (await fetch(api, { headers })).json();
const ok =
  now.smtp_host === "smtp.gmail.com" &&
  Number(now.mailer_otp_length) === 6 &&
  String(now.mailer_templates_magic_link_content ?? "").includes("{{ .Token }}") &&
  String(now.mailer_templates_confirmation_content ?? "").includes("{{ .Token }}");
console.log(
  ok
    ? "\nDone. Sign-in emails now carry a 6-digit code. Send yourself a new one to check."
    : "\nSaved, but the read-back looks different than expected — check Authentication → Emails in the dashboard.",
);
