# Summary — lapser (R1 pilot, 7 in-app days)

*25, freelance designer, iPad (gen 7), Thai UI, dark mode. Keen for 3 days, gone for 3, back on day 7.*

## Still using it?

| Point | Verdict | Why |
|---|---|---|
| **D1** | **Yes, 10/10** | ~3 min from login to my own Today. "ยืดหยุ่น — ฟรีแลนซ์" fit me, quick-add (`90m !must พรุ่งนี้`) felt like magic, the egg started warming after one workout, and the Night ritual added a lantern to my farm. I understood the farm ("แต่ละแปลงคือหนึ่งบล็อกของวัน") before bed. |
| D2 | Yes, 9 | The Sunrise ticket for getting up is a great tiny prize. But I collected six "เริ่มช้า"s, and the farm barely grew. |
| D3 | Yes, 8 | Peak: the pig hatched and I harvested a prism strawberry (×6). |
| D4–6 | **Gone** | Deadline day, then a night out, then guilt-avoidance. No reminder of any kind reached me. |
| **D7** | **Yes, but shaky, 6/10** | The comeback isn't punishing (the sleepy pig is lovely), but it isn't welcoming either. No ticket on the first tap back, streak 0, a 4% score, my best day marked "พลาด", and a dead turnip I didn't understand. I'd keep going only if something nudges me. |

## The moment I almost quit
**Day 7, 08:29, the first five seconds back:** "ตื่น 08:29 บันทึกแล้ว รอบนี้ไม่ได้ตั๋ว", immediately followed by "เริ่ม 08:29 · เริ่มช้า", then the streak calendar showing my best day (day 3) as a brown "พลาด" square. After three days of avoiding the app out of guilt, its first words were "not good enough". If the pig hadn't been cute, I'd have closed it.

(A runner-up, before the break: day 2, when after a full day of check-ins only one plot moved, "วันที่ 1 จาก 2", because the others were 10–15 min "late" and had no checklist.)

## The best moment
**Day 3, 19:27: "ฟักแล้ว! มาทักทายหมูกัน".** Three workouts turned into a pink pig. Then petting it gave "หมู ชอบมาก!". Close second: on day 7, the sleepy pig with zzz bubbles: "ง่วงและหิว ออกกำลังกายครั้งเดียวทุกตัวอิ่ม 2 วัน". It's not dead or angry, and it tells me the one thing that fixes it. That sentence is what a comeback should feel like everywhere.

## How the comeback felt
- **Not punishing, but not welcoming.** There was no modal, nothing red, and no "you failed". There was also no "welcome back". Today looks like any normal morning; I found the damage (weeds on every plot, a dead turnip, the sleepy pig, streak 0) by tapping around.
- **Recoverable:** each wilt/weed message says what clears it ("จะหายหลังผ่านวันขั้นต่ำ (ตื่นตรงเวลา + Night ritual)"). The fix took ~2 min and ~10 taps: feed, pet, truffle, replant.
- **What stung:** small "you're behind" signals stacked up. These were the missed wake ticket, "เริ่มช้า", "คะแนนวัน 4%", a brown "พลาด" square on my best day, and a turnip that died "เพราะพลาด 5 วันติด" when I'd only been gone 3. That last one turned out to be the Down Time bug below.
- **What would have stopped the lapse:** one kind push on day 4 ("หมูยังอิ่มอยู่ ไม่ต้องรีบ"), a 2-tap "busy day" mode, and knowing in advance that skipping is cheap. Push doesn't exist yet. Leave/sick days exist ("วันลาพักและวันป่วยจะหยุดนับไว้ก่อน"), but I never found where to set one.

## My 3 changes that would matter most
1. **A real "welcome back" moment after ≥2 days away.** One card on Today: what changed (pig sleepy, weeds, 1 plant lost), a single "restart in 1 minute" action (feed + clear + replant), and a **free comeback Sunrise ticket on the first "ตื่นแล้ว" back, whatever the time.** Make the first tap after a lapse a win, not "รอบนี้ไม่ได้ตั๋ว". Pair it with M11 push: one gentle nudge on day 2 of an absence, worded like the pig sheet, never streak-threatening.
2. **Stop calling me late, and stop letting one late tap erase a day.** Drop or soften "เริ่มช้า" for small delays (a freelancer's 15 min is on time). Let first-10 done count toward plot growth, not only "เริ่มตรงเวลา หรือเช็กลิสต์ครบ 70%". Don't mark a day "พลาด" in the streak calendar when the heatmap shows it as my best day; for example, give a grace window, or let the scarecrow kick in automatically.
3. **Make the Night ritual count as Down Time, and make Down Time startable from Today.** The ritual *is* the Down Time first-10 ("เล่นมือถือได้ 10 นาที → เริ่ม Night ritual"), yet the plot only grows if you dig out a hidden "เริ่ม" from the day timeline. That's how my only plant died. Related: show where harvests, truffles and "มูลค่า ×6" actually go (coins? a basket?). Harvesting felt great and then vanished.

## Bugs / defects found

Severity per QA_QC (S1 = blocker … S4 = cosmetic). Harness artefacts are excluded: date/weekday labels, the farm sky not matching her local time, and my own clock landing 10–30 min off the times I asked for.

| # | Sev | Bug | Steps / evidence |
|---|---|---|---|
| B1 | **S2** | **Down Time block can't be started from Today; the ritual doesn't credit it, so its plot never grows, gets weeds, and dies.** | At 23:xx in Down Time, the Today card is replaced by "ถึง Down Time แล้ว … เริ่ม Night ritual" with no "เริ่ม". Do the ritual every night for 3 days. Down Time plot stays "วันที่ 0 จาก 1", gets weeds (day 3), then on day 7 shows "ตายแล้ว เพราะพลาด 5 วันติด". The only way to start it is "ดูทั้งวัน" → "เปิด Down Time" → "เริ่ม" (found on day 7). `day07-farm.png` |
| B2 | S3 | **Same moment, two verdicts on waking.** | Day 2: press "ตื่นแล้ว" at 08:14 → banner "ตื่น 08:14 ตรงเวลา! +1 ตั๋ว Sunrise", while the Wake block shows "เริ่ม 08:14 · เริ่มช้า". |
| B3 | S3 | **Streak calendar and Stats heatmap disagree about the same day.** | Day 3 (all blocks done, wake pressed 08:21): streak sheet / Stats › รายวัน › ปฏิทินสตรีค show it as "พลาด", while "วันไหนทำได้ดี" shows it as the greenest day (นอน/โฟกัส/งาน green). |
| B4 | S3 | **"คะแนนวัน 4%" looks wrong.** Bars for active days are barely taller than for absent days. | Stats › ภาพรวม on day 7: the "7 วันล่าสุด" bars for พฤ/ศ (3 green blocks each in the heatmap) are about the same height as ส/อา (no app use). Wake is never green in the heatmap, even on day 2's on-time wake. |
| B5 | S3 | **Old blocks never close.** Up to 5 blocks show "กำลังทำ" at once; "จบบล็อกนี้" on Work didn't stick on day 7. | Start each block in turn without ending the previous one → "ดูทั้งวัน" shows ตื่น/โฟกัส/งาน/Gradation/เวลาว่าง all "กำลังทำ". Day 7: tapped "จบบล็อกนี้" on Work at 19:40, Work still "กำลังทำ" at 23:41. `day07-evening.png` |
| B6 | S3 | **Day-1 wake target "10:00" after setting 08:00 in setup.** | New account at 21:00 → wizard → weekday wake 08:00 → Today shows "เป้าหมาย 10:00"; Plan shows "ตื่น 08:00". Correct from day 2. |
| B7 | S3 | **Harvest/truffle rewards have no visible effect.** | Harvest "คุณภาพ: ปริซึม · มูลค่า ×6" strawberry → coins unchanged (60). "+1 เห็ดทรัฟเฟิล" → coins unchanged (10). Coins rise at other times with no explanation. |
| B8 | S3 | **Gacha "ใหม่!" on seeds the player already owns.** | Setup gives 2 strawberry seeds → first roll "สตรอว์เบอร์รี · ไม่ธรรมดา · ใหม่!". Starters carrot and turnip (already planted) also roll as "ใหม่!". |
| B9 | S3 | **Night ritual's ticked item isn't reflected in Sleep.** | Tick "ตั้งนาฬิกาปลุก + วางมือถือให้ไกลตัว" in ritual step 4 → Sleep block "ไปนอน" first-10 shows the same item unticked. |
| B10 | S3 | **Setup checklist doesn't credit the language chosen on login.** | Choose "ไทย" on the login screen → "ตั้งค่า 24/7" still lists "เลือกภาษา · 5 เหรียญ" as not done. |
| B11 | S4 | Exercise weekly counter vs egg counter mismatch. | After 3 workouts the egg hatched (3/3), but the card said "2 จาก 3 สัปดาห์นี้". *Low confidence: may be the harness date shift crossing a week boundary.* |
| B12 | S4 | Untranslated strings in the Thai UI. | "Gradation", "Down Time" (block names, plot labels), "Sleep เริ่ม 00:30 ตอนล้มตัวลงนอนให้กด ไปนอน ที่หน้า Today", "Template". |
| B13 | S4 | iPad layout is a stretched phone. | The bottom tab bar sits off-centre to the left. Bottom sheets (Night ritual, pig, streak) are phone-width and glued to the bottom edge ("ถัดไป" nearly touching it). More shows "ติดตั้งบน iPhone" on an iPad. `day01-night-today.png` |
| B14 | S4 | The "now" line in the day timeline is drawn through the block name and badge. | "ดูทั้งวัน" at 08:29: the red line strikes through "ตื่น / ยังไม่เริ่ม". `day07-return.png` |
| B15 | S4 | Time inputs show 12-hour "12:30 AM / 08:30 AM" in the Thai UI. | Setup step 2 → edit "วันธรรมดา". |
| B16 | S4 | Empty plots are drawn as sprouts; planted plots look like flat mounds. | Farm on day 1 before vs after planting. `day01-farm.png` |
| B17 | S4 | Login defaults to EN on a th-TH device. | Fresh browser with locale th-TH → "Welcome to 24/7". |
| B18 | S4 | The hatched pig isn't in the farm scene, only in the "สัตว์ในฟาร์ม" list. | Day 3 after hatching. `day03-farm-night.png` |
| B19 | S4 | Night ritual step 3 "วางแผนพรุ่งนี้" labels the block list "บล็อกของวันนี้". | Ritual step 3. |

Notes, not bugs: decor buys instantly with no confirm (fine, but I spent all 40 coins on day 1 without thinking). The wizard's 10-min picker auto-advances to the next block on tap and allows only one pick per block. There was no push notification during the absence (known: M11), and this is where it was needed most (day 4 morning).
