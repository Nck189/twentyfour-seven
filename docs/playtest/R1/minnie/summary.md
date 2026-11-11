# Minnie: R1 summary (7 in-app days)

*Persona: Minnie, 21, IE student in Bangkok, iPhone 15, Thai UI. Classes จ/พ/ศ 09–12, gym 3×/week, wakes ~07:00, bed ~23:30, plans the night before.*

## Still using it?
| Day | Score | Why |
|---|---|---|
| D1 | **8/10, yes** | Setup took ~4 min to a useful Today (≈ 15 min for the whole first evening incl. planning, farm, ritual). The quick-add syntax, the capacity line "ใช้ 1 ชม. 15 น. จากที่ว่าง 6 ชม." and the cute art sold me. |
| D2 | 7 | Strawberry sprouted the moment I ticked my checklist. But the timeline called my on-time class "เริ่มช้า" and Focus "พลาด". |
| D3 | 7 | Gold-quality strawberry from my habits (weather → quality) = first "aha". Harvest felt silent; weeds came from a schedule I can't edit. |
| D4 | 6 | Found out the big green "เสร็จแล้ว" in the task editor had **completed** my tasks. |
| D5 | 7 | First Sunrise ticket… then that wake was shown as a red "พลาด". Skipped the ritual (too tired). |
| D6 | 8 | **The cow hatched.** |
| D7 | **6/10, yes, but at risk** | Sleep stats (±minutes, trend) are exactly my thing. "คะแนนวัน 3%" and 4 dead plants caused by the schedule feel like the app is grading someone else's week. |

**D7 verdict:** I'd keep it for the cow and the sleep chart, and I'd keep planning in it for the quick-add. But if the numbers stay wrong I'd quietly go back to Notion + a habit tracker by week 3. As an IE student, a tracker with wrong data is worse than no tracker.

**Daily-loop cost (normal day):** ~2–3 min and ~25–30 taps over 4–5 opens (wake 5–10 s, midday ~15–45 s, gym ~12 s, ritual ~40–60 s, bed 5 s). The ritual alone is near the 60 s target; the whole day is not. Step 3 of the ritual (the template wall) is the heavy part.

## The moment I almost quit
**Day 4, 22:35.** I pressed the big green **"เสร็จแล้ว"** to close a task sheet, and it marked my presentation (planned for tomorrow) as **done**. Then I realised my "อ่าน SPC" from day 2 hadn't been moved to tomorrow, it had been silently completed and vanished. For a planner, losing the plan without telling me is the trust-breaker. Close second: **day 7**, opening stats to a giant **"3%"** and the farm to four "ตายแล้ว เพราะพลาด 5 วันติด" plots, including my Focus strawberry, which died because the app's Focus block (08:00–09:30) overlaps my class/commute and I can't move it.

## The best moment
**Day 6, after the gym:** "ฟักแล้ว!" → a round little cow, "มาทักทายวัวกัน · ไม่ธรรมดา", then ลูบหัว → a floating pink heart and "วัว ชอบมาก!". Three workouts → one cow was a goal I could watch fill up (1/3 → 2/3 → 3/3). Runner-up: day 3's **"คุณภาพ: ทอง · มูลค่า ×3 — น้ำค้าง / ประกาย"**, where my habits visibly became crop quality.

## My 3 changes that would matter most
1. **Make Today *be* my plan, and let my day fit my life.** Show my planned tasks inside their block on Today (they only appear in วางแผน and in ritual step 2). Let me adjust block start/length per day kind (or drag on "ดูทั้งวัน"), and respect my class slot: my จ/พ/ศ is class 09–12 → gym → free, not "งาน 09:00–18:00". Blocks the app placed wrong shouldn't count as "พลาด", grow weeds, or kill plants.
2. **Make every number trustworthy, and show the rule behind it.** Fix "คะแนนวัน 3%" (or show how it's computed); credit an early "ตื่นแล้ว" to *today* and roll Today over immediately; don't call after-the-fact check-ins or early bedtimes "เริ่มช้า"; print the ticket window under the wake button ("ได้ตั๋วถ้ากด 06:30–07:10"); let the ritual tag "แผนไม่ตรง" instead of forcing a fake reason that then becomes my "#1 reason (100%)" in stats.
3. **Let the rewards land where I can see them.** The cow should live *on* the farm scene, not only in a list. Harvests and milk ("+1 สตรอว์เบอร์รี", "+1 นม", "มูลค่า ×6") need a visible destination (basket → coins, or something to make). Warn me a day before a plant dies ("อีก 1 วันจะเหี่ยว"). Make a Rare reveal look rarer than a common one. Explain "ชิ้นส่วน".

## Bugs found
| ID | Sev | Bug | Steps to reproduce | Evidence |
|---|---|---|---|---|
| B4 | **S2** | Task editor's primary green **"เสร็จแล้ว"** marks the task **complete**; it looks like "done editing". The task silently disappears from the day (undo exists as "ยังไม่เสร็จ" only if you reopen the task). | วางแผน → tap a task → change day/block → tap the green เสร็จแล้ว → the list circle becomes pressed/disabled; reopen → button now reads "ยังไม่เสร็จ" | `day04-task-done-button.png`; day 2 + day 4 |
| B19 | **S2** | Stats ภาพรวม shows **"7 วันล่าสุด คะแนนวัน 3%"** with near-empty bars, contradicting the "วันไหนทำได้ดี" heatmap (นอน/งาน dark green most days) and a week of 6/7 rituals, all checklists, 6/7 wakes. | Play a normal week (checklists ticked, rituals done, never pressing "จบบล็อกนี้") → สถิติ → ภาพรวม | `day07-stats.png` |
| B18 | **S2** | Pressing **"ตื่นแล้ว" before the wake target** gives "ตรงเวลา! +1 ตั๋ว Sunrise", but Today stays on *yesterday* (yesterday's timeline, ไปนอน card, even "ถึง Down Time แล้ว… เริ่ม Night ritual" at 06:42). The ตื่น block / first-10 isn't available, and later that day "ดูทั้งวัน" shows **ตื่น — พลาด** in red. The ตื่น plot then can't grow. | Wake target 07:00 → at 06:40 press ตื่นแล้ว → reload → at 12:40 open ดูทั้งวัน | `day05-early-wake.png`, `day05-wake-missed-after-ontime.png` |
| B6 | **S2** | The day timeline ignores the person's real day: งาน is always ~9 h (09:30–18:30 on the อ/พฤ kind, 09:00–18:00 on class days although class is 09–12); โฟกัส 08:00–09:30 overlaps class and is marked "พลาด"; a planned gym shows as "09:30 ออกกำลังกาย 60 นาที" inside class. No UI to edit block times. Consequence: weeds, then **"ตายแล้ว เพราะพลาด 5 วันติด"**. | Setup วันเรียน class 09:00–12:00 → Today → ดูทั้งวัน; วางแผน → ✎ shows "ตัวอย่าง" with no edit | days 2–3, 7 (`day07-farm-after-deaths.png`) |
| B3 | **S2** | Raw internal key in the 10-min field: **"@s:work:1"**, **"@s:focus:3"**. | Setup step 3: pick a suggested first-10 for งาน/โฟกัส → วางแผน → พรุ่งนี้ → ✎ → open the block | `day01-raw-key-bug.png` |
| B7 | S3 | Planned tasks never appear on Today (in any block card, or in "ดูทั้งวัน"), even with a block assigned (โฟกัส). They only resurface in ritual step 2 "วันนี้ยังไม่เสร็จ". | Plan a task for tomorrow (block โฟกัส) → next day open Today | days 2, 5 |
| B5 | S3 | Produce has no visible destination/value: harvest "+1 สตรอว์เบอร์รี" (ปริซึม, "มูลค่า ×3/×6") and cow "+1 นม" leave coins unchanged; no inventory screen found. The harvest pop is <2 s (easy to miss). | Farm → ready plot → เก็บเกี่ยว → reload, coins same | days 3, 6, 7 |
| B10 | S3 | The Down Time plot is never credited for doing the Night ritual during Down Time (died day 7). Plants die with no prior warning. | Do the Night ritual nightly without pressing Down Time "เริ่ม" → the plot stays "วันที่ 0", then "ตายแล้ว" | days 4, 7 |
| B9 | S3 | Status words are wrong: ticking a checklist after class auto-starts the block as **"เริ่มช้า"**; going to bed 25 min **early** → **"เริ่ม 23:05 · เริ่มช้า"**. | At 12:15 tick the class checklist; at 23:05 (target 23:30) press ไปนอน → เริ่ม | days 2–7 |
| B8 | S3 | The ตื่น block stays **"กำลังทำ"** all day in ดูทั้งวัน (ritual step 2 says "ทำแล้ว"). | Tick wake first-10 at 07:15 → ดูทั้งวัน at 22:00 | days 2–3 |
| B2 | S3 | Template picker shows **"แบบวันที่ 3" ×9** plus presets the user never made (วันมีเรียน, วันมีเรียน (ไม่บังคับ), เสาร์กับครอบครัว…); settings shows only 3; no delete. Likely cause: reloading /welcome resets the wizard to step 1 while kinds added via "เพิ่มแบบวัน" are already saved. | Setup 2/4 → เพิ่มแบบวัน → reload → redo setup → วางแผน → ✎ | day 1 |
| B1 | S3 | On signup night, after setup set wake 07:00, Today still showed **"เป้าหมาย 10:00"** until the next day. | Sign up ~21:00, set wake 07:00 in setup → Today | `day01-after-setup.png` |
| B16 | S3 | A checklist saved via "ใช้เป็นค่าเริ่มต้นของงาน" appears on every day kind (class items on no-class days) and plots need "เช็กลิสต์ครบ 70%", which invites ticking things that didn't happen. | Save the class checklist as default → open Today on the อ/พฤ kind | day 3 |
| B15 | S3 | The wake ticket window is never shown; "รอบนี้ไม่ได้ตั๋ว" gives no reason. | Press ตื่นแล้ว 15+ min after target | days 2–4 |
| B13 | S3 | A day kind can't be renamed ("แบบวันที่ 3" forever). | Setup 2/4 → เพิ่มแบบวัน → open it, tap the title | day 1 |
| B12 | S4 | Login shows EN on a th-TH device; the setup task "เลือกภาษา 5 เหรียญ" isn't credited though ไทย was picked at login (must re-tap ไทย in More). | Fresh login on a Thai phone → More | day 1 |
| B11 | S4 | Copy/i18n: untranslated "Gradation"/"Down Time" (truncated "Down Ti…" on farm); "Sleep เริ่ม 23:30…"; "ทำ first-10 ของ Wake"; "บล็อกของวันนี้" in the *tomorrow* sheet; "ถัดไป: นอน" under the ไปนอน card; time pickers "11:30 PM" in a 24-h Thai UI; "อีก 1 งาน…" (task vs Work block?); "วางแผนคืนนี้ โตไปพร้อมพรุ่งนี้" reads translated. | — | days 1–5 |
| B14 | S4 | Egg copy contradicts: "ทุกครั้งที่ 3 จะได้ไข่หนึ่งฟอง" (Today tip) vs "ออกกำลังกายครบ 3 ครั้งไข่จะฟัก" (farm). | Compare after the first ritual | day 1 |
| B17 | S4 | Before the first planting the plots show sprouts; after planting they become dirt mounds (the farm looks emptier after you act). | Farm before/after planting | day 1 |
| B20 | S4 | Quick-add "#IE" stays in the task title, and "!must" isn't shown as a badge in the list (it is saved). | Add "ส่งรายงาน 45m !must พรุ่งนี้ #IE" | day 1 |

**Not app bugs (harness):** odd header dates/weekdays, the weekly exercise counter resetting mid-run, and the wake chart's few points are probably from time travel; I didn't count them.
