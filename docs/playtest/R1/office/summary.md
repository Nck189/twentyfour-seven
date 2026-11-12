# Summary — office (busy office worker, 32, iPhone SE, Thai UI) · R1, 7 days

## Daily-loop cost (her key metric)
| Day | Morning | Night | Day total | Notes |
|---|---|---|---|---|
| 1 (setup) | — | sign-in 5 taps + setup 8 + 1 | **14 taps · ~2 min** | "ตั้งค่า 2 นาที" held true |
| 2 | 1 tap · ~10 s | 6 taps · ~45 s | **7 · ~55 s** | first ritual, planted radish |
| 3 | 1 · ~8 s (late 07:19) | skipped | **1 · ~8 s** | |
| 4 | 1 · ~13 s | 5 · ~30 s | **6 · ~43 s** | |
| 5 | 1 · ~12 s | skipped | **1 · ~12 s** | |
| 6 | 1 · ~10 s | 5 · ~25 s | **6 · ~35 s** | |
| 7 | 1 · ~12 s | skipped | **1 · ~12 s** | |

- **Median day (2–7): ~3.5 taps, ~24 s.** Every day was under 60 s. Speed is not the problem.
- The problem is that **at this effort level the app gives her almost nothing back**. The farm never grew, she never found out what tickets are for (until a tester peek), and every night the ritual lists her workday as "not done".

## Still using it?
- **D1: yes (6/10).** The `ทำงานประจำ — ทำงาน จ–ศ 9–18 น.` preset fit her exactly, setup took about 2 minutes, and the morning button is clear.
- **D7: half (5/10).** She pressed `ตื่นแล้ว` on 7/7 mornings (6 on time): a 1-tap habit with a friendly "ตรงเวลา! +1 ตั๋ว". She did the Night ritual on 3/6 nights, only when she happened to open the app. She never opened the farm, tickets, stats or weekly review on her own.
- **D14 (prediction): wake tap only, or gone.** The first time she opens the farm and sees 7 piles of dirt after 2 weeks, she uninstalls.

## The moment she almost quit
**Day 5, 06:21.** She pressed "I'm up", and the biggest card under the confirmation said "**23:00 ไปนอน** — กดเริ่มตอนล้มตัวลงนอน ตรงเวลา = ภายใน 10 นาทีจากเวลานอน — `เริ่ม`". That's "go to bed", at breakfast. On days 2, 4 and 6 it was "ถึง Down Time แล้ว พร้อมปิดวันนี้และวางแผนพรุ่งนี้ไหม?" at 6 am. *"If the app doesn't know I'm awake after I told it I'm awake, why am I telling it?"*
(Out of character, the day-7 farm peek would have been the real quit moment: 7 plots of `แรดิช วันที่ 0 จาก 1` after 6 on-time wakes.)

## The best moment
**Day 3, 07:19, overslept:** `ตื่น 07:19 บันทึกแล้ว รอบนี้ไม่ได้ตั๋ว`. No guilt, and the screen was correct (current block `ตื่น`). *"OK, no ticket, fair."* Close second: setup step 1, `ทำงานประจำ` = her life in one tap.

## Her 3 changes that would matter most
1. **Let the 2 things I *do* grow the farm, and show it to me.**
   - An on-time "ตื่นแล้ว" should count as the Wake block's on-time start.
   - Finishing the ritual / `ราตรีสวัสดิ์` should count for Down Time or Sleep.
   - After the wake tap, show a tiny farm peek or toast on Today: "แรดิชโตแล้ว · เก็บได้!", "9 ตั๋ว → หมุนตู้กาชา".
2. **When I press "I'm up", it's today.** Flip Today, the sky and the streak to the new day on the wake tap. If last night wasn't closed, say so kindly and offer one tap: "เมื่อวานยังไม่ได้ปิดวัน · [ใช้แผนเดิมสำหรับวันนี้]".
3. **Make the night 1 tap, and remind me.**
   - A push at Down Time (M11).
   - In ritual step 2, one `วันนี้ทำตามปกติ ✓` that marks the day OK (backfilled, no tickets) instead of "บล็อกไหนไม่ได้ทำ?".
   - Auto-reuse the last template when the ritual is skipped.

## Other observations
- Ritual step 3 shows 8 templates (`วันมีเรียน`, `เสาร์กับครอบครัว` …) she never created. Show only her own day types.
- `ทบทวนประจำสัปดาห์ได้แล้ว · +3 ตั๋ว` reads like homework, and tickets have no visible use.
- An animal needs 3 workouts, so a no-workout user never gets one. Consider a starter animal.
- 0 coins all week, while decorations cost 30–300: nothing to chase.
- English in the Thai UI: `Template`, `Down Time`, `Night ritual`, `Gradation`, `Sunrise`, "Sleep เริ่ม 23:00…".
- The office preset puts Focus at 07:30–09:00, which is her commute.

## Bugs found
> Harness caveat: time was simulated by switching timezones and shifting history. Re-check bug 1 once with a real clock.

| # | Sev | Bug | Steps | Seen |
|---|---|---|---|---|
| 1 | S2 | Pressing "ตื่นแล้ว" before the target wake doesn't start the new day. Today shows yesterday's "ถึง Down Time แล้ว… · เริ่ม Night ritual" (last night not closed) or "23:00 ไปนอน · เริ่ม" (closed). No current block, streak 0, date a day earlier, farm sky at night. Correct by ~07:20. | Target 06:30 → open /today at 06:15–06:22 → tap ตื่นแล้ว (gets "ตรงเวลา! +1 ตั๋ว Sunrise") → reload | Days 2, 4–7; day 3 (07:19) fine |
| 2 | S2 (rule gap, maybe per SPEC §8.1) | The Wake plot never grows from an on-time wake. After 6 on-time wakes all plots are `แรดิช วันที่ 0 จาก 1`, though the ritual says "ทั้ง 7 แปลงกำลังโตอยู่". | Plant in ritual → 5 days of wake + ritual, no block `เริ่ม` → /farm | day07-farm-testerpeek.png |
| 3 | S3 | Ritual step 2 has no "did it" path. Lived-but-untapped blocks (even `ตื่น` after an on-time wake) are listed as "บล็อกไหนไม่ได้ทำ?". | Day without block taps → ritual step 2 | Days 2, 4, 6 |
| 4 | S3 | The streak changes silently (1 → 0 on day 4, no message) and reads 0 on most mornings before the day flips. | Skip one ritual → compare pill morning vs night | Days 4–7 |
| 5 | S3 | Setup evening: the wake card still says `เป้าหมาย 10:00` after she set 06:30, and "ตื่นแล้ว" is the top card at 21:00. | New account 21:00 → setup → Today | Day 1 |
| 6 | S3 | `ราตรีสวัสดิ์` is disabled with no hint until the alarm box is ticked. | Ritual step 4 → tap ราตรีสวัสดิ์ | Day 2 |
| 7 | S3 | The login screen opens in English on a th-TH device. | Fresh browser th-TH → /login | Day 1 |
| 8 | S4 | "เลือกภาษา 5 เหรียญ" isn't credited after picking ไทย at login. | /more#setup | Day 1 |
| 9 | S4 | "แก้ได้ทุกเมื่อที่ More → ตั้งค่า", but the tab is `เพิ่มเติม`. | Setup step 4 | Day 1 |
| 10 | S4 | iPhone SE day-type editor: weekday chips overflow (`อา` cut), wake field touches the edge, 12-hour "11:30 PM" in Thai. | /welcome → ทำงานประจำ → วันทำงาน | Day 1 |
| 11 | S4 | Farm plot labels truncated: `Dow…`, `Grad…`, `เวลาว่…`. | /farm on SE | Day 7 |
| 12 | S4 | After the ritual is done, the Today Down Time block still says "เล่นมือถือได้ 10 นาที → เริ่ม Night ritual". | Finish ritual → Today | Day 2 |
| 13 | S4 | The setup reward card shows once (dropped on reload), and its strawberry seeds never appear in the ritual seed picker. | Setup → reload → ritual step 3 | Days 1–2 |
| 14 | S4 | The `สถิติ` tab appears unannounced (4 → 5 tabs). | — | Day 6 |
| 15 | S4 | Mixed English in the Thai UI (`Template`, `Down Time`, `Gradation`, `Sunrise`, "Sleep เริ่ม…"). | — | All days |

## Where she needed a push (none exist yet)
- ~21:30 Down Time "ปิดวันนี้ 30 วิ" would have recovered the 3 skipped nights (days 3, 5, 7).
- 23:00 "ไปนอน": never pressed all week. Better to make ราตรีสวัสดิ์ count as bedtime than to add a push.
- 06:30 wake: she remembered on her own every day, so this is low priority.
