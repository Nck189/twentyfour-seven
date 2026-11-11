/**
 * Playtest kit (docs/PLAYTEST_PLAN.md), LOCAL ONLY. Players drive the real app UI with this;
 * only the harness parts (code, at, nextDay, skipDays) touch the database, for things a person
 * would get from real life: their email and the passing of time.
 *
 *   const kit = require("/home/user/m6-wt/tests/playtest/kit.cjs");
 *   const s = await kit.start("minnie");          // browser on the persona's device, signed in if before
 *   await s.page.goto(kit.BASE + "/today");
 *   await kit.shot(s, "day01-today");            // → docs/playtest/R1/minnie/day01-today.png
 *   await kit.end(s);                            // keeps the session for next time
 *   kit.code("minnie")                           // the 6-digit code from the newest sign-in email
 *   kit.at("minnie", "22:30")                    // local time ≈ 22:30 on the current day (reload after)
 *   kit.nextDay("minnie", "06:55")               // a new day begins at ≈ 06:55
 *   kit.skipDays("lapser", 3, "08:10")           // gone 3 days, back at ≈ 08:10
 *   kit.now("minnie")                            // { day, date, local, tz }
 *   kit.resume("minnie", "13:05")                // after the run was paused: back to ≈ 13:05 today
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");

const BASE = process.env.PLAYTEST_BASE ?? "http://localhost:3999";
const MAILPIT = "http://127.0.0.1:54324";
const ROUND = process.env.PLAYTEST_ROUND ?? "R1";
const REPO = path.resolve(__dirname, "../..");
const OUT = path.join(REPO, "docs/playtest", ROUND);
const STATE =
  process.env.PLAYTEST_STATE ??
  "/tmp/claude-0/-home-user-twentyfour-seven/70c331e7-c8a5-54e2-a6b6-8031bbfe6cac/scratchpad/playtest";
const PERSONAS = JSON.parse(fs.readFileSync(path.join(__dirname, "personas.json"), "utf8"));

function sql(q) {
  return execFileSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      q,
    ],
    { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8" },
  ).trim();
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function persona(name) {
  const p = PERSONAS[name];
  if (!p) throw new Error(`unknown persona ${name}`);
  return { name, ...p };
}
function statePath(name) {
  fs.mkdirSync(path.join(STATE, name), { recursive: true });
  return path.join(STATE, name, "state.json");
}
function readState(name) {
  try {
    return JSON.parse(fs.readFileSync(statePath(name), "utf8"));
  } catch {
    return { day: 1, date: null };
  }
}
function writeState(name, st) {
  fs.writeFileSync(statePath(name), JSON.stringify(st, null, 2));
}
function uid(name) {
  const id = sql(`select id from auth.users where email = ${lit(persona(name).email)}`);
  if (!id) throw new Error(`${name} has no account yet (sign in through the app first)`);
  return id;
}

// ---------- time ----------
let zonesCache = null;
function zones() {
  if (!zonesCache) {
    zonesCache = sql(
      "select name || '|' || (extract(epoch from utc_offset) / 60)::int from pg_timezone_names " +
        "where name !~ '^(posix|right|SystemV)/' and name !~ 'GMT0|UCT|Zulu'",
    )
      .split("\n")
      .map((l) => {
        const [n, o] = l.split("|");
        return { name: n, off: Number(o) };
      });
  }
  return zonesCache;
}
const addDays = (d, n) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
/** Best zone so that local time ≈ `hhmm` on local date `date` (within 30 min), or null. */
function zoneFor(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const target = Date.parse(`${date}T00:00:00Z`) / 60000 + h * 60 + m; // minutes, as if UTC
  const nowMin = Date.now() / 60000;
  const want = target - nowMin; // offset (minutes) that makes local = target
  let best = null;
  for (const z of zones()) {
    const d = Math.abs(z.off - want);
    if (d <= 30 && (!best || d < best.d || (d === best.d && /^(Etc|Asia)\//.test(z.name))))
      best = { ...z, d };
  }
  return best;
}
function localNow(tz) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => f.find((p) => p.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}
function setTz(name, tz) {
  sql(`select qa.set_tz(${lit(uid(name))}, ${lit(tz)})`);
}
function profileTz(name) {
  return sql(`select timezone from public.profiles where user_id = ${lit(uid(name))}`);
}

function offsetOf(tz) {
  const z = zones().find((x) => x.name === tz);
  if (!z) throw new Error(`unknown timezone ${tz}`);
  return z.off;
}
/** Harness state: the persona's current day number, its local date label, and the tz offset. */
function timeState(name) {
  const st = readState(name);
  if (st.date && st.off !== undefined) return st;
  const tz = profileTz(name);
  return { ...st, day: st.day ?? 1, date: localNow(tz).date, off: offsetOf(tz) };
}

/** Where the persona is in time. */
function now(name) {
  const st = readState(name);
  let tz = null;
  try {
    tz = profileTz(name);
  } catch {
    /* not signed up yet */
  }
  const l = tz ? localNow(tz) : null;
  return { day: st.day ?? 1, date: l?.date ?? null, local: l ? `${l.date} ${l.time}` : null, tz };
}

/**
 * Moves the persona's clock forward to ≈ `hhmm` local, `days` days after its current day
 * (0 = later today). The timezone changes so that "now" reads that local time, and the whole
 * history moves with it (dates by whole days, timestamps by minutes) so every past event keeps
 * its local date and time. Reload any open page afterwards.
 */
function travel(name, days, hhmm, { resume = false } = {}) {
  const st = timeState(name);
  const id = uid(name);
  const targetLabel = addDays(st.date, days);
  const todayUtc = new Date().toISOString().slice(0, 10);
  let pick = null;
  for (const d of [addDays(todayUtc, -1), todayUtc, addDays(todayUtc, 1)]) {
    const z = zoneFor(d, hhmm);
    if (!z) continue;
    const k = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${targetLabel}T00:00:00Z`)) / 86400000);
    const shift = st.off - z.off + 1440 * k; // minutes; ≤ 0 = history moves into the past
    if (!pick || Math.abs(k) < Math.abs(pick.k)) pick = { d, z, k, shift };
  }
  if (!pick) throw new Error(`can't reach ${hhmm} right now (UTC offsets only go −12…+14 h)`);
  if (pick.shift > 5 && !resume)
    throw new Error(`${hhmm} on day ${st.day + days} is already past for ${name}`);
  if (pick.k !== 0 || pick.shift !== 0) sql(`select qa.shift_user(${lit(id)}, ${pick.k}, ${pick.shift})`);
  setTz(name, pick.z.name);
  writeState(name, { ...readState(name), day: st.day + days, date: pick.d, off: pick.z.off });
  return now(name);
}
const at = (name, hhmm) => travel(name, 0, hhmm);
const nextDay = (name, hhmm) => travel(name, 1, hhmm);
const skipDays = (name, days, hhmm) => travel(name, days, hhmm);
/**
 * After a pause in the run itself (the players stopped, real hours went by), puts the persona's
 * clock back to ≈ `hhmm` on its current day, where it was. History moves forward by the pause,
 * so nothing that happened before reads as later than it did.
 */
const resume = (name, hhmm) => travel(name, 0, hhmm, { resume: true });

// ---------- email ----------
/** The 6-digit code from the newest email to this persona (what they'd read in their inbox). */
async function code(name) {
  const email = persona(name).email;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`);
    const list = await res.json();
    const msg = list.messages?.[0];
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const m = String(full.Text ?? full.HTML ?? "").match(/\b(\d{6})\b/);
      // Read once: the next sign-in waits for its own, newer email.
      await fetch(`${MAILPIT}/api/v1/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDs: [msg.ID] }),
      });
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no code email for ${email}`);
}

// ---------- browser ----------
async function start(name, opts = {}) {
  const p = persona(name);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const dev = devices[p.device] ?? devices["Desktop Chrome"];
  const storage = path.join(STATE, name, "storage.json");
  const ctx = await browser.newContext({
    ...dev,
    deviceScaleFactor: 1,
    locale: p.locale === "th" ? "th-TH" : "en-US",
    colorScheme: p.theme === "dark" ? "dark" : "light",
    reducedMotion: p.reducedMotion ? "reduce" : "no-preference",
    storageState: fs.existsSync(storage) ? storage : undefined,
    ...opts,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  return { browser, ctx, page, persona: p, taps: 0 };
}
async function shot(s, label) {
  const dir = path.join(OUT, s.persona.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}.png`);
  await s.page.screenshot({ path: file, fullPage: false });
  return file;
}
async function end(s) {
  const storage = path.join(STATE, s.persona.name, "storage.json");
  fs.mkdirSync(path.dirname(storage), { recursive: true });
  await s.ctx.storageState({ path: storage });
  await s.browser.close();
}

module.exports = { BASE, OUT, persona, start, shot, end, code, now, at, nextDay, skipDays, resume, sql };
