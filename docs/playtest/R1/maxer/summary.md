# Summary — maxer (min-maxer gamer, 27, software tester · Mac Chrome · EN · dark) · R1, 7 in-app days

## Still using it?

| Day | Verdict | Why |
|---|---|---|
| **D1** | **Yes (8/10)** | Setup takes ~1 min after the code. The "Set up 24/7" reward checklist and the **visible pity counter** ("Rare+ in 10 · Epic+ in 30 · Legendary by 80") are exactly my bait. |
| **D7** | **Yes, conditionally (7/10)** | The ×10 on day 7 (2 Rares) plus discovering shards → ★ star-ups gave me a goal again. But the numbers I can see don't add up (Day score 1%, collection counters going backwards, "×4 value" that pays nothing), and a min-maxer leaves when he can't trust the numbers. If week 2 shows the same 2 tickets/day and no coin sink, I'm gone by D14. |

Daily ratings: D1 8 · D2 7 · D3 7 · D4 7 · D5 6 · D6 7 · D7 7.

Daily-loop cost on a normal day: **~25–30 taps, ~2 min of screen time** spread over 8 opens. The Night ritual itself is 8 taps / 12 s if you skip the timer.

## The moment I almost quit
**Day 5, Stats → "Last 7 days · Day score · 2%".** I'd woken on time 4 days running, done every ritual and cleared my Work checklist 3/3 daily. The game's own scoreboard said I'd basically done nothing. That number also gates the "Perfect day (+1 ticket)" bonus, which I **never earned in 7 days**. A close second: day 7, "Focus · Radish · It died after 5 misses in a row." The Office-job template gives Focus **0 minutes** (09:30–09:30), so that plot was doomed from setup, and editing my work hours doesn't fix it.

## The best moment
**Day 7, Pull ×10:** Lettuce, Radish, **Blueberry (Uncommon)**, Lettuce, Radish ×3, **Pumpkin (Rare)**, **Sunflower (Rare)**, Radish. Then I found that dupes give "+1 shard" and that tapping Radish in the Seed-dex offers **"Star up · 5 shards"** → ★2. I also checked the pity counter afterwards (9/19/69) and it matched my own arithmetic exactly. A runner-up: the Duck hatching on my 3rd workout (day 4).

## Economy assessment

**Week 1 totals (from my ledger):**

| Currency | In | Out | Notes |
|---|---|---|---|
| Capsule tickets | **11**: setup 1, Sunrise 4 (d2–d5), Night 6 (d1–d5, d7). **Perfect-day bonus: 0** | 11 (1 single + one ×10) | Hard ceiling **2/day** (Sunrise + Night). One late wake (08:47) = no Sunrise. |
| Coins | **170**: setup 40; then ≈22/day from tasks (+10 per Must task, +30 for a 45-min backlog task, +30 overnight once with no explanation) | 90 (Krathong, "This month") | Only sinks: decor with no stats. "More fields · Unlock with coins (soon)". |
| Shards | 6 (dupes) | 5 (Radish ★2) | **No shard total shown anywhere** except inside each Seed-dex entry. |
| Animal feed | 3 (setup) | 0 | Never needed: workouts feed the Duck. |
| Crops | Strawberry (Prismatic, ×4), Radish, Turnip | — | "+1 Strawberry"… and then nothing. No inventory, no sell, no coins. |

- **Pull rate:** 2 tickets/day means **one ×10 every 5 days** at perfect play. In 11 pulls I got 1 Uncommon and 2 Rares, and nothing above Rare (Epic pity at 30 pulls ≈ day 15, Legendary by 80 ≈ day 40). Singles and ×10 are identical (no ×10 discount, no bonus), so saving up has zero value except the show. There is **no odds table**: only pity numbers.
- **What I'd chase next:** Epic pity (19 pulls ≈ 10 days), Seed-dex 5/20, Radish ★3 (10 shards), Pond (300 coins ≈ 10 days), the "More fields" unlock once it's not "(soon)", the 7-day streak collection item (again, after day 6), a second Duck egg. **There is a next goal after week 1.** But each one is 1–2 weeks away, and between ×10s there's nothing to spend on or optimise. Coins pile up with no use. Crops vanish.
- **Day 6 (lazy day) fairness: mostly fair.** Late "I'm up" (10:45) + no check-ins + no ritual cost exactly what I'd expect: 0 tickets, streak 4 → 0 the next morning, weeds on missed plots. No shaming copy ("Missed" labels are neutral), and nothing was taken back. Unfair parts:
  - (a) the streak dialog permanently shows **two scarecrow icons**, so I assumed I had 2 saves banked; I had 0 ("earn one every 7 days");
  - (b) the Focus plant died, but that was the 0h template, not the lazy day;
  - (c) the farm said "Sunrise Glow · **Woke on time**" on the morning I got up at 10:45.

## My 3 changes that would matter most
1. **Make the score honest and reachable.**
   - Fix Day score (1–2% after solid days) so "Perfect day (+1 ticket)" is achievable.
   - Never generate a 0-minute block: Office-job Focus is 0h, auto-"Missed" daily, grows weeds, kills the plant after 5 days, and makes "Over by Xm" equal total task time.
   - Show the "I'm up" ticket window on the button ("08:00–08:45") instead of only "Target 08:30".
2. **A wallet / ledger + odds screen.** One place listing tickets, coins and shards with every +/− and its reason ("+10 coins · Must task 'Inbox zero'", "+1 Sunrise · up 08:24"). Add a rarity odds table next to the pity line, and one line each for what quality (Prismatic), weather multipliers ("×4 value") and ★ stars actually *do*. Right now three reward systems are invisible or decorative.
3. **Give the in-between days something to optimise:**
   - harvests that pay coins (×4 Prismatic should feel like a jackpot);
   - a real coin sink (More fields, seed upgrades);
   - a proper reveal moment for Rare+;
   - and stop collection counters from silently resetting. Label them "this week" and show the reset day, or don't reset them.

## Bugs found

| # | Sev | Bug | Steps / evidence |
|---|---|---|---|
| 1 | **S2** | **Day score far too low** ("2%" on day 5, "1%" on day 7) despite on-time wakes, rituals and 3/3 Work checklists. Bars flat at the floor; Perfect-day ticket never awarded. | Play 4 normal days → Stats → Overview. `day05-stats-dayscore-2pct.png` |
| 2 | **S2** | **Office-job template creates a 0h Focus block** (09:00–09:00, later 09:30–09:30). It is auto-"Missed" every day → weeds → "It died after 5 misses in a row." Editing Work hours only stretches Wake; Focus stays 0h. | Setup → Office job → Plan → "Plan Today" preview shows "Focus 0h". Day 7 farm: `day07-focus-died.png` |
| 3 | **S2** (if not harness) | **Collection progress went backwards**: "10 Must tasks done" 7 done on day 5 → "2 of 10" on day 7; "20 first-10s" 4 of 20 after 15+ ticked; "100 blocks finished" 4 of 100. Header "Weekly" but no reset rule shown. | Farm → Collection on day 5 vs day 7. (Harness date shifts may contribute.) |
| 4 | S3 | **Going to bed >10 min early is labelled "Started late".** | Bedtime 01:00 → tap Start at 00:48 → "Started 00:48 · Started late" (also 00:45). 00:53 → "On time". `day02-bed-early-says-late.png` |
| 5 | S3 | **"Over by Xm" always equals total task time** on Work days (45m task → "Over by 45m"; 35m → "Over by 35m"). Capacity seems to be the 0h Focus block. | Plan → add "X 45m !must today" → day card shows "Over by 45m". |
| 6 | S3 | **Weather says "Sunrise Glow · Woke on time" and "Spark · Exercised"** on a day I woke at 10:45 and didn't exercise. | Day 6: press I'm up 2h late, open Farm → Today's weather. `day06-late-wake.png` |
| 7 | S3 | **Very late "I'm up" gives no feedback** (button just disappears), while 17 min late shows "Up at 08:47. Logged — no ticket this time." | Press I'm up at 10:45 vs 08:47. |
| 8 | S3 | **Harvest value invisible**: "Quality: Prismatic · Weather on this crop · ×4 value" → Harvest → "+1 Strawberry". Coins unchanged; no crop inventory anywhere. Strawberry plot auto-replants; Radish/Turnip plots go empty. | Farm → ripe plot → Harvest. `day04-harvest.png` |
| 9 | S3 | **Seed-dex ignores seeds you grew**: the setup Strawberry (planted, harvested) never appears; dex counts capsule pulls only. | Grow + harvest Strawberry → Seed-dex still "1 of 20". |
| 10 | S3 | **Desktop Farm pane says "The backlog is coming soon."** while Plan has a working Backlog/Inbox. | Mac width → Farm tab → right pane. |
| 11 | S3 | **Streak dialog shows two scarecrow icons when you own none**; the streak dropped 4 → 0 with no save. | Today → Streak button on days 1–7. `day03-streak-zero.png` |
| 12 | S3 | **Today shows yesterday after "I'm up"** until the scheduled wake time: Sleep card + "Night ritual done" + **streak 0**, even after a qualifying day. | Press I'm up at 08:19 for an 08:30 target → header "0", streak dialog "0 days"; at 09:19 → "1". |
| 13 | S3 | **Coins arrive with no receipt** (+30 overnight day 2→3); task toasts read just "+10" / "+30" with no unit or reason. | Compare Decor coin total morning vs night. |
| 14 | S4 | Stats Sleep tab shows two different spreads for the same thing ("give or take 4 min" vs "Wake-up ±7 min"; later ±69 vs ±65). Streak calendar and "Which days go well" heatmap stay empty after 7 days. | Stats → Sleep / Days. |
| 15 | S4 | Duck always says "Fed for 2 more days" (day 4, 5, 7), regardless of time passed. | Farm → Duck. |
| 16 | S4 | Task tag not parsed: "Review regression test plan #work" keeps "#work" in the title. | Plan → backlog: "X 45m !must tomorrow #work". |
| 17 | S4 | Adding a task with "tomorrow" gives no confirmation; today's backlog still says "Nothing here yet." | Same input as #16. |
| 18 | S4 | Setup reward "Add 24/7 to your Home Screen · Flowers for your farm" can't be completed on desktop (only "Install on iPhone" instructions), so it stays stuck at "6 of 7". | More → Set up 24/7 on Mac. |
| 19 | S4 | Setup wizard loses progress if you navigate away mid-way (back to "1 / 4"). | /welcome → step 3 → leave → return. |
| 20 | S4 | Day 1 Today showed "Target 10:00" while Plan said Wake 08:30 after setup. Fixed itself on day 2. | Sign up in evening → complete setup → Today. |
| 21 | S4 | Bought decor has no "Owned" state; Krathong tile looks the same, just greyed for lack of coins. | Farm → Buy Krathong. |
| 22 | S4 | "Logged! Your first egg is warming up." repeats on the 2nd workout. | Log 2 workouts. |
| 23 | S4 | Rare pulls get almost no visual distinction in the ×10 grid (slightly bluer circle). | `day07-x10-pull.png` |
| 24 | S4 | Stats tab appears in the nav with no announcement; ★ star-up and shards are never explained. | — |

**Harness notes (not app bugs):**
- Clock jumps are 30–60 min, so many blocks show "Started late" and Wake was "Missed" on days 2–3 when it shouldn't have been. The asymmetric I'm-up window and the growth findings take that into account.
- Weekday stays Wed, so no weekend was tested.
- Dates on screen wander between 8 and 11 Nov, and "Exercise x of 3 this week" jumps around.
- Bug #3 and the farm sky being daytime at 21:00 on day 1 may be affected by the shifted dates and the browser clock.
