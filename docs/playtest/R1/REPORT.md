# Playtest R1 — pilot after v1 (2026-11-10/11)

Four simulated people lived with the real app (local Supabase, `main` at 44b82be) for 7 in-app days each, starting from the login screen. Each one's diaries, screenshots and summary are in this folder (`minnie/`, `office/`, `lapser/`, `maxer/`). Time was simulated with the playtest kit (`tests/playtest/`).

**Harness limits:**
- Dates on screen stay around 9–11 November and the weekday never advances, so there's no weekend and no Sunday review.
- Clock jumps landed 10–60 min off the requested times, so a few "late" labels are artefacts.
- Players flagged suspected artefacts themselves, and this report leaves them out.

**These are proposals.** Minnie decides; nothing gets built from them without her OK.

## 1. Retention ("Will I open it tomorrow?", 0–10)
| Persona | D1 | D7 | D14 (their guess) | Almost quit when… | Best moment |
|---|---|---|---|---|---|
| **minnie** (target user, iPhone, TH) | 8 | 6 | at risk | the task editor's green **"เสร็จแล้ว"** silently completed her tasks (day 4) | the cow hatching after 3 gym sessions, and the heart when petting it |
| **office** (30-second user, iPhone SE, TH) | 6 | 5 | wake tap only, or gone | **"23:00 ไปนอน"** shown right after she pressed "I'm up" at 06:21 | a late wake treated kindly: "ตื่น 07:19 บันทึกแล้ว รอบนี้ไม่ได้ตั๋ว" |
| **lapser** (gone 3 days, iPad, TH, dark) | 7 | 6 | maybe | coming back to streak 0, a dead plot, and her best day marked "พลาด" | the sleepy pig, which names the problem and the one fix |
| **maxer** (min-maxer, Mac, EN, dark) | 8 | 7 | yes, conditionally | Stats: **"Day score 2%"** after a near-perfect week | the ×10 pull: 2 Rares, and the pity counter matched his own maths |

**Main drop-off reason:** the app punishes a normal life. Things people *did* aren't credited, so plants die and scores read 1–4%, and the rewards they earned have no visible use.

## 2. First run
- **Time to a useful Today:**
  - office: ~2 min (14 taps; the `ทำงานประจำ` preset fit her exactly);
  - minnie: ~4 min;
  - maxer and lapser: ~3 min.
- **Friction:**
  - The login screen opens in English on a Thai phone.
  - "เลือกภาษา" isn't credited when the language was picked at login.
  - The setup wizard restarts at step 1 on reload, and its saved day kinds pile up (minnie had nine "แบบวันที่ 3").
  - On the setup evening the wake card still says "เป้าหมาย 10:00".
  - Time fields show 12-hour "11:30 PM" in Thai.
  - Raw keys showed in the first-10 field ("@s:work:1").
- Nobody understood before day 2 what the farm is fed by (on-time **starts**, not just doing the block).

## 3. Daily-loop cost
| Persona | Normal day | Target < 60 s |
|---|---|---|
| office | **~24 s**, 3–4 taps (wake + ritual on some nights) | ✅ |
| minnie | **2–3 min**, 25–30 taps over 4–5 opens; the ritual alone takes 40–60 s | ❌ |
| lapser | ~2 min on active days | ❌ |
| maxer | ~3 min (he explores everything on purpose) | n/a |

The cheap path (wake tap + ritual) is fast. Everything that actually grows the farm is expensive: tapping "Start" on each block within ±10 min, or ticking 70% of a checklist.

## 4. Hook check (trigger → action → reward → investment)
- **Trigger: weak.**
  - There are no pushes (M11). Every skipped night in the run would plausibly have been saved by one at Down Time.
  - Today never points to the farm, tickets or Stats.
- **Action: OK for the wake and the ritual; heavy for block check-ins.**
  - Down Time can't be started from Today. During Down the card is the ritual prompt, and the block can only be started from the full-day list.
- **Variable reward: good where it fires,** in capsules, pity, quality and the cow hatch. But:
  - most of it is invisible: produce has no use (M13), coins come with no reason, and "×4 value" pays nothing;
  - a Rare looks the same as a common;
  - the hatched animal isn't in the farm scene.
- **Investment: undermined.** Plants die from rules people don't see coming ("ตายแล้ว เพราะพลาด 5 วันติด" with no warning). Scores (1–4%) contradict the heatmap and the person's own effort.

## 5. Economy (maxer's ledger, confirmed by minnie)
- **Tickets:** 2 a day at most (Sunrise + Night), so a ×10 every ~5 days. The Perfect day ticket **never paid** in 4 × 7 days (see bug P1).
- **Coins:** almost only from backlog tasks. Office earned 0 all week, while decor costs 30–300 and "More fields" is "(soon)".
- **Pity:** Epic ~10 days away, Legendary ~35. The Seed-dex was 5/20 after a week. There *is* something to chase, but it's slow and partly hidden:
  - no odds table;
  - shards and stars are only found by tapping a Seed-dex entry;
  - nothing says what a star does.
- **Produce:** kept, with no use until M13 (Factory).

## 6. The comeback (lapser)
**Neutral, not welcoming.** No scolding, but no "welcome back" either. She found the weeds, the dead turnip and the sleepy pig by tapping around. The first lines she saw were "เริ่มช้า", "ไม่ได้ตั๋ว", streak 0 and "คะแนนวัน 4%". Restarting took ~2 min and 10 taps.

## 7. Ethics check
- **No dark patterns found.** The lazy day felt fair to maxer, and late wakes are handled kindly ("no ticket this time").
- **Too many "late / missed" signals for a flexible person:**
  - early starts are labelled "เริ่มช้า" (going to bed 25 min early, a checklist ticked after class);
  - one 21-min-late wake marked her best day "พลาด" in the streak calendar.
- **Plant death from unseen rules is the harshest thing in the app.** It conflicts with SPEC's "kind" intent.

## 8. Ranked change list

### A. Bugs to fix now (test-first, no rule change needed)
| ID | Sev | Problem (evidence) | Fix | Effort |
|---|---|---|---|---|
| P1 | S2 | **A 0-minute block is judged as missed.** maxer's office template gave "Focus 09:30–09:30 · 0h", marked missed daily; the plant died and the day score fell to 1–2%. minnie saw the same with Focus squeezed by class (day-07, `day07-farm-after-deaths.png`). | A block with no time left that day isn't judged: not in Day score, not a miss (TS `blockResult`/`dayOee` + SQL `_block_result`/`_day_oee`). | S |
| P2 | S2 | **"I'm up" before the target leaves Today on yesterday** (office days 2, 4–7; minnie day 5): a "go to bed" card at breakfast, streak 0, and later that wake shows "พลาด". | A pressed wake starts the wake-day (client `currentDayDate` + server `_wake_day`). | M |
| P3 | S2 | **The task editor's green "เสร็จแล้ว" completes the task**; it reads as "done editing" (minnie day 4, `day04-task-done-button.png`). | Rename it "บันทึก" (save); make "complete" a separate, clearly labelled action. | S |
| P4 | S2 | **Raw first-10 keys show** ("@s:work:1", "@s:focus:3") in the 10-min field (minnie day 1, `day01-raw-key-bug.png`). | Resolve suggestion keys everywhere the field is shown or edited. | S |
| P5 | S3 | **Setup wizard reload** resets to step 1 while saved day kinds stay, so duplicates pile up. | Resume at the saved step; reuse kinds that are already saved. | S |
| P6 | S3 | **"เริ่มช้า" for early starts** (bed 25 min early, a checklist ticked late but the block was done). | Only a start after the planned start + 10 min is "late"; early is "early". | S |
| P7 | S3 | **The wake card says "ตรงเวลา!" while the Wake block says "เริ่มช้า"**, and Wake stays "กำลังทำ" all day. | An on-time wake press is the Wake block's on-time start, and it closes when Focus starts. | S |
| P8 | S3 | **Login opens in English on a Thai device**, and "เลือกภาษา" isn't credited. | Default the login language from the browser; credit the setup task when a language was picked there. | S |
| P9 | S4 | Thai UI mixes in English ("Template", "Down Time", "Gradation", "Sunrise", "Sleep เริ่ม…"); time fields are 12-hour; plot labels are truncated on the SE; the iPad gets a stretched phone layout. | i18n and layout pass. | S–M |

### B. Changes that need Minnie's call (they change game rules or SPEC)
| ID | Problem | Proposal | Effect | Effort |
|---|---|---|---|---|
| R1 | **What people do isn't credited.** Plants grow only on an on-time "Start" or a ≥70% checklist; first-10s and the ritual don't count. | The **Night ritual counts as Down Time's start**, **"I'm up" counts as Wake's** (= P7), and **"Going to bed" counts as Sleep's**. A first-10 done within the block counts as a start (not "late"). | Day score becomes believable (Perfect days become reachable); the farm grows for low-touch users. | M |
| R2 | **Plants die without warning** after 5 misses, even during an absence. | Days with **no app open at all are "away"**: the farm pauses (no weeds, no death), like Vacation. Show "wilting, 1 more miss" before a death. | Removes the harshest comeback moment. | M |
| R3 | **Comeback** is neutral. | A "ยินดีต้อนรับกลับ" card with one "start today" tap, a gift on the first wake after a lapse, and a 3-day "back on track" mini-goal (minimum days only). | Lapser D7 6 → ~8 (their estimate). | M |
| R4 | **Rewards have no visible use.** | A **market stand**: sell produce for coins by quality ("×4 value" means something), with a receipt for every coin. Later, M13 recipes. | Coins get a source; harvests feel worth it. | M |
| R5 | **Tasks don't appear on Today.** | Show the block's planned tasks in the current-block card. | The plan you made shows up on the day you live. | S–M |
| R6 | **Block times can't be edited**, and classes don't move Work (minnie). | Per-day block time edits (drag or "Move to…"), and make class slots shape Work. | Fits real student days. | L |
| R7 | **The ritual's step 2 assumes failure** ("บล็อกไหนไม่ได้ทำ?"). | One tap, "วันนี้ทำตามปกติ ✓", marks un-tapped blocks as done (backfilled, no tickets). | Night ritual under 30 s. | S |
| R8 | **Economy clarity** (maxer). | An odds table in the capsule sheet, a bigger Rare reveal, an explanation of stars and shards, and animals walking in the farm scene. | Gives min-maxers something visible to chase. | M |
| R9 | **Pushes (M11)**: Down Time and a kind day-2 "we miss you". | Already planned for M11; the playtest says Down Time matters most. | Recovers skipped nights. | (M11) |

### C. Next milestone
- **M11 (push):**
  - Down Time "ปิดวันนี้ 30 วิ" first;
  - then a kind "หมูคิดถึงนะ" on day 2 of an absence, at most weekly;
  - the wake push is low priority (everyone remembered on their own).
