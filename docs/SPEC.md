# 24/7 — Product Spec v0.2
*A 7-block day planner + cozy farm game. Based on the book 24 ชั่วโมงของเราไม่เท่ากัน / 最初の「10分」がすべて (Koji Inoue).*
*"1 day = 24 hours = 7 blocks" — hence the name. Working name; the display name can be shortened (e.g. "24/7").*

Owner/first user: Minnie (Bangkok, Asia/Bangkok). Personal use first, designed so it can become a public multi-user product later.

---

## 0. Product principles
1. **The day starts at Down Time.** Tomorrow is planned tonight (Night ritual).
2. **The first 10 minutes of every block is the switch.** Each block has one "first-10" action; it gets the biggest reward.
3. **Planned deviation ≠ failure.** Like OEE excluding planned downtime: a late night planned in advance is not a miss.
4. **The app gives structure, never content.** Never suggest what the user should do inside a block.
5. **Daily-usable.** A block check-in takes ≤ 5 seconds; everything works one-handed on a phone.
6. **Rewards only come from real behavior.** No purchases, no shortcuts.
7. **Forgiving but honest.** Minimum day / freeze / vacation mode exist, but every action stores its real timestamp.
8. **Everything is per-user configurable** (durations, targets, templates, checklists, tags, goals). Defaults below are Minnie's.

---

## 1. Platform & stack
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel (Hobby).
- **Backend:** Supabase — Postgres, Auth (Google + email magic link), Row Level Security, Realtime, Edge Functions, pg_cron.
- **PWA:** installable on iPhone/iPad (Add to Home Screen) and Mac (Safari "Add to Dock"); manifest `display: standalone`; service worker.
- **Web Push:** VAPID, for block-start nudges. iOS needs 16.4+ and the home-screen app. Permission is asked only after a user tap. Every push must show a notification (no silent push).
- **Devices:** iPhone (primary), iPad, Mac.
  - Phone: bottom tab bar — Today · Plan · Farm · Stats · More.
  - iPad/Mac: split view — timeline left, farm/backlog right.
- **Drag & drop:** dnd-kit (touch + mouse). Every drag has a "Move to…" tap fallback.
- **i18n:** English (default) / Thai, switchable in Settings; all strings go through a dictionary (next-intl).
- **Time:** store `timestamptz` (UTC); compute days in the user's timezone (default Asia/Bangkok). A "day" runs from wake to the next wake, not midnight to midnight.
- **Art:** flat, NO outlines, pastel; depth from darker same-hue shapes. Hand-built SVG React components — no AI images, never black strokes (see CLAUDE.md).
- **Sound:** short SFX via WebAudio synth and/or CC0 packs (e.g. Kenney). Global mute plus skip-animation.
- **Free-tier care:**
  - Supabase free projects pause after ~1 week idle → daily keep-alive cron (Vercel cron or GitHub Action).
  - Free plan has no backups → "Export all data (JSON/CSV)" in Settings.
- **AI review (optional):** connect the Supabase connector in Claude chat to analyze data, or upload a CSV export.

---

## 2. Blocks, templates, targets

### 2.1 The 7 blocks (book defaults, editable)
| # | Block | Default duration | Default first-10 (editable) |
|---|---|---|---|
| 1 | Down Time | 1h30 | 10 min free phone time → start Night ritual |
| 2 | Sleep | 7h30 | Alarm set + phone out of reach |
| 3 | Wake | 1h | Leave the bedroom + open curtains / get light |
| 4 | Focus | 1h30 | (user-defined) |
| 5 | Work | 9h | Map the day: Must / Should / Just start |
| 6 | Gradation | 1h | One small task immediately on arriving home |
| 7 | Free | 2h30 | (user-defined) |

### 2.2 Default weekly templates (Minnie)
| Template | Days | Target wake | Fixed events |
|---|---|---|---|
| Free weekday | Mon, Tue, Fri | 10:00 | — (highest-risk days: home + bed) |
| Class day | Wed | 07:30 | Class 09:00–16:00 |
| Class day (optional) | Thu | 07:30 if attending, else 10:00 | Class 09:00–12:00 (toggle "going / skipping") |
| Family Saturday | Sat | 10:00 | Out with family (editable) |
| Family Sunday | Sun | 10:00 | Dinner at relatives' until ~20:00 |
| Home weekend | Sat/Sun when staying in | 10:00 | — |

- She skips breakfast and eats lunch first, so Wake/Focus contain no meal by default.
- The Work block on free weekdays means YOP, senior project and personal goals; the user fills it in.
- **Kaizen target (optional, off by default):** if wake success is ≥ 5/7 this week, the target wake moves 15 min earlier next week, down to a user-set floor (e.g. 08:30). This shrinks the class-day vs free-day gap gradually instead of forcing it.

---

## 3. Scheduling engine (pure TS module, fully unit-tested)
- **Chain:** Down → Sleep → Wake → Focus → Work → Gradation → Free → next Down. Sum = 24h.
- **Night-before bedtime** for day D = `D.targetWake − sleepDuration` (Down Time starts 1h30 before that).
- **Anchor = bedtime.**
  - Pushing tonight's bedtime later pushes D's wake and all of D's blocks.
  - Exception: a fixed event on D blocks the push, so blocks get compressed instead (see below).
- **Snap-back:** the next night's bedtime returns to the template target. The lost time comes out of flexible blocks, so drift never accumulates.
- **Compression order when something must give:**
  1. Free
  2. Gradation
  3. Focus
  4. Work (min 50% of its length) — skipped on a day with a fixed event in Work (class or appointment): she has to show up for those anyway *(Minnie, 2026-11-02: protect sleep before Work, but keep balance)*
  5. Down (min 30m)
  6. Wake (min 30m)
  7. Sleep, last — with a warning "only Xh sleep"
- **Guardrails:**
  - Warn when planned bedtime deviates more than 60 min from the 7-day mean.
  - Show a sleep regularity score.
- **Late-night mode:** "Out late tonight" → enter return time → engine re-plans and tags it `planned` (no miss, no weeds).
- **Sub-slots** inside any block (e.g. Work 12:00–14:00 YOP). They move with their block.
- **Exercise constraint:** warn if a gym slot ends after the gym closes (default 22:00, editable).
- **Overrides** are per-day; templates stay untouched.

**Required test scenarios** (at minimum):
- Normal day.
- Bedtime +1.5h on a free day, then snap-back.
- Bedtime +2h before a Wed class: sleep is compressed and a warning fires.
- Planned late night: tagged `planned`, not a miss.
- Thu class toggled off.
- Sub-slots shift with their block.
- Compression hits the minimums.

---

## 4. Daily flow

### 4.1 Night ritual (starts at Down Time)
1. 10-min free-phone timer (from the book).
2. **Close today:** close open blocks and tag miss reasons (sleepy / phone / interruption / social / sick / other).
3. **Plan tomorrow:**
   - Pick the template and adjust bedtime.
   - Drag backlog items onto days.
   - Review each block's checklist.
   - **Plant seeds in the 7 plots.**
4. Set alarm + phone away → "Goodnight". The farm switches to night and grants a **Night ticket**.

### 4.2 Morning
- Big button: **"I'm up — out of bed."**
  - Within 15 min of target wake → **Sunrise ticket** + ☀️ mutation.
  - Later → the real time is logged, no ticket.

### 4.3 Block check-in (≤ 5 s)
1. **Start:** logs the real start time; on-time means within ±10 min.
2. **First-10:** tick it.
3. **Checklist:** tick items.
4. **Close:** optional mood/energy 1–5.

Extras:
- **Location tag** (home / out) on Focus and Work — asked when the block is finished.
- **One thing at a time (Minnie, 2026-11-02):** Today shows only what the moment needs — the "I'm up" card in the morning, the current block (Finish appears once it has started), a one-line "Next: …", and the Night ritual at Down. The full-day timeline is folded behind "See the whole day"; the nap timer and Vacation/Sick mode live in the ⋯ menu (a running nap shows on Today).
- **Backfill** is allowed: it counts toward %, is labeled `backfilled`, and earns no tickets or mutations.

### 4.4 Other
- **Power-nap timer:** 20–25 min with an alarm sound. Unplanned naps are logged.
- **Vacation / Sick mode:** pauses the streak and freezes farm penalties.

---

## 5. Backlog ("everything I need to clear")
- **Inbox:** quick capture (type + Enter).
- **Fields:**
  - title
  - project tag (default: YOP, Senior project, Class, Personal, Family, Health — editable)
  - estimate (min)
  - priority (Must / Should / Just start — from the book)
  - deadline
  - optional sub-checklist
- **Week strip (Mon–Sun):**
  - Drop on a day → the item lands in that day's Work block; tap to move it to another block.
  - On iPad/Mac, drop directly onto a block.
- **Capacity bar per day** (RCCP-style): sum of estimates vs free minutes in the target blocks; red when overloaded.
- **Unfinished items:** the Night ritual asks where to carry them; a `carry_count` is kept.
- **Deadlines:** near-deadline items float to the top.
- **Appointments, any distance ahead** *(Minnie, 2026-11-03: the dentist or a friend can book months ahead)*:
  - Typed in the same capture line: a date + a time (`Dentist 15/3 14:00`, `หมอฟัน 15 มี.ค. 10:00`, `Dinner mar 15 7pm`, ranges `13:00-16:00`) becomes a one-off fixed event on that day's plan, not a backlog task. A date without a time plans the task that day.
  - A date without a year means the next time that date comes round; Buddhist-era years are accepted.
  - The block the time falls in holds it (before wake-up → Wake moves earlier; after the last block → Free), so the engine fits the day around it (§3).
  - Plan shows the next appointment under the week strip, a month view (dots: appointment / tasks) reaches any month, and the Night ritual mentions tomorrow's appointments.

---

## 6. Exercise
- **Weekly goal:** default 3 sessions, shown as a ring; no daily requirement.
- **Log:** type (gym / run / walk / other) + minutes.
- **Scheduling:** a floating item that can go into any block, with the gym-close warning.
- **Never breaks the streak** — drives the animals instead (§8.6).

---

## 7. Stats & analytics
- **Day OEE** = Availability × Performance × Quality
  - **Availability** = blocks started on time / planned blocks (excluding `planned` deviations).
  - **Performance** = checklist items done / planned.
  - **Quality** = first-10 success rate.
- **Wake-time control chart:** I-MR with mean ± 3σ, split weekday vs weekend; out-of-control points flagged.
- **Sleep regularity:** SD of bed/wake times over a rolling 7 days + drift line.
- **Heatmap:** block × weekday success rate.
- **Pareto:** miss reasons.
- **Home vs out:** completion % compared.
- **Streak calendar** (GitHub-style).
- **Weekly review** (Sunday night):
  - Week summary.
  - KPT: Keep 1 / Problem 1 / Try 1.
  - Reward: +3 tickets.
- **v2:** estimate vs actual → personal planning-fallacy multiplier, used by the capacity bar.

---

## 8. Farm game

### 8.1 Behavior → game mapping
| Real behavior | In game |
|---|---|
| Planning a block for tomorrow | Plant a seed in that block's plot |
| Block success (on-time start OR checklist ≥ 70%) | That plot grows +1 day |
| First-10 done | ☀️ fertilizer → higher quality |
| Checklist item ticked | 💧 water (for extra field plots) |
| Woke on time + out of bed | Sunrise ticket |
| Night ritual complete | Night ticket |
| Perfect day | +1 ticket + 🌈 Rainbow mutation |
| Backlog item done | Coins (Must > Should > Just start) |
| Exercise session | Animal feed + egg progress |
| Weekly review | +3 tickets + harvest festival chest |

- **7 block plots** = the 7 blocks. A weak block is visible at a glance (visual management / andon).
- **Extra field plots:** unlocked with coins and grown with 💧 water.

### 8.2 Crops (general farm, increasingly advanced)
| Rarity | Grow (success-days) | Examples |
|---|---|---|
| Common | 1 | Radish, Turnip, Lettuce, Carrot |
| Uncommon | 2 (regrow) | Strawberry, Blueberry, Tomato, Corn |
| Rare | 3 | Pumpkin\*, Melon\*, Sunflower, Coffee |
| Epic | 5 | Dragon fruit, Lavender, Grape, Cherry tree |
| Legendary | 7 | Star fruit, Moon melon, Crystal rose, Rainbow corn |

- **\* Giant crop:** 3 adjacent plots (= 3 consecutive blocks) with the same crop, all successful → chance to merge into a giant crop (momentum bonus).
- **Regrow:** harvest without replanting.
- **Quality:** Normal / Silver / Gold / Prismatic, from first-10 rate + checklist %.
- **Harvest feel matters most:** juicy "pop" sound, bounce, particles.

### 8.3 Mutations ("weather" from yesterday's behavior; stack multiplicatively)
| Mutation | Earned by | Multiplier |
|---|---|---|
| ☀️ Sunrise Glow | Woke on time + out of bed | ×2 |
| 💧 Dew | Wake first-10 done | ×1.5 |
| 🌙 Moonlit | Down first-10 + phone away on time | ×2 |
| 🍃 Breeze | Focus/Work out of home | ×1.5 |
| ⚡ Spark | Exercised | ×2 |
| 🌈 Rainbow | Perfect day | ×5 |

Each mutation has its own visual tint / particles.

### 8.4 Penalties (scaled by severity)
- **No penalty:** `planned` deviations, Vacation/Sick mode.
- **1 missed day of a block:** weeds appear and the crop pauses. Weeds clear after the next minimum day.
- **3 consecutive misses:** wilt (−1 quality).
- **5 consecutive misses:** the crop dies → becomes compost (partial fertilizer back).

### 8.5 Gacha (server-side rolls via Postgres RPC — no client tampering)
- **Seed capsule machine**, full animation:
  - Shake → crack → rarity-colored light → jingle whose pitch rises with rarity.
  - Skip button.
  - Pull ×1 or ×10.
- **Rates:**
  - Common 60%
  - Uncommon 28%
  - Rare 9%
  - Epic 2.5%
  - Legendary 0.5%
- **Pity:**
  - Rare+ guaranteed every 10 pulls.
  - Epic+ guaranteed at 30.
  - Legendary soft pity from 60, hard pity at 80.
  - Pity counter visible.
- **Duplicates** → seed essence → star-up crops ★1→★5 (raises base value/quality), soulstone-style.
- **Seed-dex:** silhouettes for unowned seeds + completion %.
- **Ticket income (~2–3/day):**
  - Sunrise 1
  - Night 1
  - Perfect day +1
  - Weekly review +3
  - Streak milestones (7 / 14 / 30 days) +5
  - Target: about one Legendary a month with consistent behavior.

### 8.6 Animals (driven by exercise)
- **Egg incubator:** every 3 workouts hatches 1 egg (animal gacha).
  - Common: chicken, duck, bunny
  - Uncommon: cow, sheep, pig
  - Rare: cat, dog, goat
  - Epic: capybara, alpaca
  - Legendary: red panda, golden goose
- **Feeding:** 1 workout = 2 days of feed.
  - Fed → produce (egg / milk / wool / …) + love meter up.
  - Hungry → sleepy and sad. **They never die.**
- **Interaction:** tap/pet animals for a reaction + sound.

### 8.7 Streak
- **Minimum day** = "I'm up" within the window + Night ritual done → the streak survives.
- **Perfect day** = minimum day + Day OEE ≥ 80%.
- **Scarecrow (freeze):** earned every 7-day streak, hold max 2, auto-used on a missed day.

### 8.8 Seasons
- Each real calendar month is a season, with a limited banner and festival decorations (Loy Krathong, Christmas, New Year, Chinese New Year, Songkran, …).
- **Harvest festival** at month end = monthly review.

### 8.8b Unlocks & milestones (Minnie, 2026-11-03 — proposal, rewards land with M6–M9 art)
Something is always "almost unlocked", so there's a reason to come back. Small and frequent early, bigger later. Every unlock is granted **server-side** once (read-only ledger, like ticket grants); rules are static content (`content/unlocks.ts`); progress is computed from data, never UI state.
- **Small (first days):** firsts. First Night ritual → lantern decor; first backlog item done → mailbox; all first-10s in one day → sunflower seed.
- **Medium (weekly):** counts. 20 first-10s → better watering can; 10 Must items done → harvest cart; 7-day streak → an animal egg (plus the existing scarecrow).
- **Big (monthly):** farm-changing. 30-day streak → pond / new farm area; 100 blocks closed → house upgrade; 4 weekly reviews → a festival theme.
- **Feature reveals (progressive disclosure, also keeps a new user's screens calm):** Stats after 3 days of data; the gacha machine with the first ticket; farm expansion after the first harvest.
- **UI:** a collection book on the Farm tab (locked = soft silhouette + a progress ring "2 more"); Today shows at most one quiet line with the next near unlock (picture + "1 more night"); unlocking uses the reward animation (skippable, reduced-motion aware). No emoji — hand-built art only.

### 8.9 Decor & sky
- **Coins buy:** fences, paths, flowers, house, pond, plot expansions.
- **Sky follows the current block:** Down = dusk, Sleep = stars, Wake = sunrise, daytime blocks = day.

---

## 9. v2 (built immediately after v1)
- **Push notifications:**
  - Block start.
  - First-10 nudge.
  - "I'm up" reminder.
  - Night-ritual reminder.
  - Sent by Supabase pg_cron + an Edge Function.
- **Calendar export:** .ics feed for iPhone/iPad/Mac calendars.
- **Share availability:**
  - Public link with a secret token showing free/busy only — no account needed.
  - Friends can request a slot (name + note) → pending → owner accepts → inserted as a fixed event (uses the engine).
  - "Copy free slots" as text/image for LINE.
- **Factory (IE flavor):**
  - Machines: jam jar, cheese press, bakery, loom.
  - Recipes: crops + animal goods → products.
  - Real-time process queues and machine upgrades.
  - KPI panel: throughput, utilization, bottleneck.
- **Planning-fallacy analytics** (estimate vs actual).

---

## 10. Data model (Postgres; every table has `user_id uuid` + RLS `user_id = auth.uid()` unless noted)
- `profiles`
  - display_name, timezone, locale, sound_on, onboarding state
- `settings`
  - block durations, first-10 defaults, gym_close_time, weekly_exercise_goal, kaizen settings, wake window minutes
- `templates`
  - id, name, weekdays[], target_wake, blocks jsonb (durations, sub-slots, checklists, first-10), fixed_events jsonb
- `day_plans`
  - date, template_id, bedtime_override, planned jsonb (computed blocks), late_night jsonb, mode (normal / vacation / sick)
- `block_logs`
  - date, block, planned_start, started_at, first10_at, closed_at, items_done jsonb, mood, energy, location, backfilled bool, miss_reason
- `backlog_items`
  - title, tag, estimate_min, priority, deadline, scheduled_date, block, status, carry_count, checklist jsonb, done_at
- `exercise_logs`
  - at, type, minutes
- `wake_events`
  - date, target_wake, pressed_at, in_window bool
- `game_state`
  - coins, tickets, essence jsonb, pity jsonb, streak, best_streak, freezes, season
- `plots`
  - slot (block1–7 | field_n), crop_id, star, planted_on, growth_days, quality, mutations[], weeds, wilt_level, state
- `inventory`
  - item_id, qty
- `seed_dex`
  - crop_id, first_seen, count, star
- `animals`
  - species, name, love, fed_until, last_produced
- `decor`
  - item_id, x, y
- `gacha_pulls`
  - at, banner, result, rarity, pity_before (audit)
- `events`
  - append-only event log (type, payload, at) — source of truth for analytics/audit
- **v2 tables:**
  - `push_subscriptions`
  - `share_links` (token, scope)
  - `booking_requests` (anon insert via RPC with token + rate limit)
  - `machines`, `production_jobs`

**Static game content** (crops, animals, rarity tables, seasons, decor catalog): versioned TS/JSON in the repo, not in the DB.

---

## 11. Non-goals (for now)
- Social feed, friends' farms, leaderboards.
- Monetization.
- Native iOS app (the PWA first).
- AI that suggests what to do.
