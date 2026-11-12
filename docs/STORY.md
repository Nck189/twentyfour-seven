# Story events: the orange cat (draft)

Minnie's call (2026-11-12): milestone events with short cutscenes, told by an **orange farm cat**. Built **after the economy PR and before M11**. This is a draft for her to read; nothing is final until she OKs the beats. The cat's name is set.

## The cat
- **Who:** an orange tabby who lived on the old farm before you came. Curious, a bit lazy, very loyal. Never judges and never nags. It naps when you're away and is happy when you come back.
- **Name:** **ส้ม / Som** (Minnie, 2026-11-12).
- **Art:**
  - Built like the other animals: flat, no outlines, 3 tones, light from the top-left, readable at 48 px.
  - Poses: sit, sleep, stretch, happy, look-up, carry-seed.
- **Where it shows up:**
  - cutscenes;
  - the welcome-back card (R3);
  - the M11 pushes ("ส้มรออยู่นะ" / "Som is waiting for you");
  - sometimes napping on the farm scene.

## Chapters (one beat each, unlocked by real progress)
| # | When (data) | Beat (one line) | Gift |
|---|---|---|---|
| 0 | First open after setup | The cat finds you at the overgrown gate. | — |
| 1 | First harvest | The cat sniffs the produce and claims a radish leaf. | 1 seed |
| 2 | 3 minimum days | It brings you an old watering can from the shed. | 1 ticket |
| 3 | First animal hatched | It is jealous of the chick, then they nap together. | — |
| 4 | Streak 7 | A stroll at sunset; the farm sign gets repainted. | decor: farm sign |
| 5 | Farmhouse Lv 1 | It moves into the house and takes the best cushion. | — |
| 6 | 30 days used (not a streak) | A photo album of your month on the wall. | 2 tickets |
| 7 | Each season's festival | A short seasonal scene (Songkran, Loy Krathong, …). | festival decor discount |
| R | Back after a lapse | The cat wakes up, stretches, and is glad to see you (replaces the plain card text). | the existing +1 ticket |

## Rules for the director
Pure logic in `lib/game/director.ts`; the server records what was seen.
- At most **one beat a day**, and never twice for the same chapter.
- Plays only at **calm moments**: opening the Farm tab, or right after Goodnight. Never during the wake window, Down Time or a running block's check-in.
- **Always skippable** (tap or Skip). With reduced motion it plays as still panels. Muted with the global mute.
- **No feature is locked behind a beat** and nothing is time-limited, so missing a beat loses nothing: it waits for the next calm moment.
- Gifts are granted by a `claim_story_beat(id)` RPC that checks the condition from data. The client never decides.
- Each beat logs an event (`story_seen`).

## Cutscene format
- 3–5 panels, 10–20 s in all.
- Each panel is an SVG scene (farm parts already exist) plus one line of text from i18n (EN/TH, short), with a soft motion: pan, the cat's pose change, sparkles.
- Scripts are typed data in `content/story.ts`: `{ id, trigger, panels: [{ scene, pose, lineKey, motion }], gift }`.

## Build order
1. The cat's art (6 poses) and the `story_seen` table + RPCs.
2. The director (unit tests: one a day, calm moments only, no repeats, condition checks) and the cutscene player (reduced-motion and skip E2E).
3. Chapters 0–2, then the rest one at a time.

## Seasonal crops and their story beats (Minnie OK 2026-11-12)
There is one seasonal crop a month, but something new happens every two weeks:
- **Days 1–14, planting season:** the crop's seed is sold in the seed shop and can drop from capsules.
- **Days 15–end, seasonal market:** the crop sells at ×1.5 and has a special order.
- **No FOMO:** a crop missed this year comes back next year. The Seed-dex gets a 12-slot "crop calendar" that says when each one returns.

Each month has **3 beats**, all directed by the same rules as above (one a day, calm moments, skippable). Gifts are granted by the server.
1. **Opening (day 1):** Som introduces the crop.
2. **Market (day 15):** the seasonal market opens.
3. **Use:** the first time you sell, deliver or "use" the crop, something special happens, different every month.

| Month | Crop | Opening (day 1) | Market (day 15) | Using it → what you get |
|---|---|---|---|---|
| Jan | **ดอกพลุ** Firework Bloom | Som chases sparks out of a seed packet. | A night market with string lights. | **Fireworks night**: the farm sky shows small fireworks for 3 nights, +1 ticket. |
| Feb | **ส้มมงคล** Lucky Mandarin | Som rolls a golden mandarin to your door. | Red lanterns on the stall; neighbours ask for pairs. | **อั่งเปา**: deliver a pair to get a red envelope with a server-rolled 20–88 coins. |
| Mar | **ลูกท้อชมพู** Blossom Peach | The tree flowers before it fruits; Som sneezes at petals. | A picnic market under the blossoms. | **Blossom blessing**: petals fall on the farm for a week, and one chosen plot's next harvest gets +1 quality step. |
| Apr | **มะม่วงทอง** Golden Mango | Som naps in a mango's shade. | A Songkran splash market. | **ข้าวเหนียวมะม่วง party**: every animal is fed for a day, +1 love each, with a Som-and-animals splash scene. |
| May | **เห็ดฝนแรก** First-rain Mushroom | The first rain; mushrooms pop up overnight. | A rainy-day market under umbrellas. | **Rain soup**: a warm bowl for Som; your next day's growth is guaranteed "dew" weather (×1.5). |
| Jun | **บัวสายฝน** Rain Lily | Som watches lilies open in the puddles. | A floating market on the pond. | **Lotus pond**: your pond decor blooms for good (a decor variant). |
| Jul | **ข้าวหอมเรืองแสง** Glow Rice | Rice glows softly at dusk; Som is mesmerised. | A night-rice market lit by the rice itself. | **Firefly path**: fireflies live in the night farm scene for good. |
| Aug | **ชามะลิ** Jasmine Tea | Som carries jasmine sprigs in its mouth. | A Mother's Day tea stall. | **A cup for someone you love**: an optional private note goes in your reward jar ("โทรหาแม่"), the Night ritual's phone timer gets a calm jasmine chime, +1 ticket. |
| Sep | **ฝักบัว** Moon Lotus Seed | Lotus pods under a huge moon. | A lantern market. | **Moon lantern** decor. In M13 it is the mooncake recipe's key ingredient. |
| Oct | **ฝ้ายสายไหม** Candy-floss Cotton | The first cool wind; Som shivers. | A cosy wool market. | **Som's scarf**: Som wears a pink scarf from then on (a Som outfit). |
| Nov | **บัวหลวงแสงเทียน** Candle Lotus | Som finds a lotus with a tiny flame in it. | A krathong market on the water. | **Float a wish**: write a private wish (optional, own row) and float it. At next year's Loy Krathong, Som brings the wish back to you. |
| Dec | **สตรอว์เบอร์รีหิมะ** Snow Strawberry | Mist on the hills; white strawberries. | A winter-lights market. | **Year-end cake + your year in review**: a short montage from your own data (harvests, best streak, mornings on time), saved as a page in the collection book. |

**Build order:**
1. The seasonal crop system: calendar, shop/capsule/market hooks, and orders.
2. Nov (Candle Lotus) and Dec (Snow Strawberry), since they're the next two months, with their 3 beats.
3. Each other crop, with its art and beats, ahead of its month.

Each "use" reward is server-side and checked once per crop per year.

## More Som moments (small, high value; part of the story work)
Approved to add on 2026-11-12 ("ถ้ามีทำได้เลย"). Each reuses existing art and data:
1. **Sunday with Som:** the weekly review opens with Som reacting to *your* week, and shows the best day, the best block and the miss reason that came up most. The tone is kind: "สัปดาห์นี้ตื่นทัน 5 เช้า ส้มภูมิใจ". It turns the review from a form into a moment.
2. **Meet the new animal:** when an animal hatches, a 3-panel scene shows Som meeting it. Each of the 13 species reacts differently: the chick hides behind Som, the cow licks Som, the pig steals Som's cushion.
3. **Exam week** (students, Minnie's own case):
   - When the Plan has an appointment tagged exam/สอบ, Som wears a headband, brings snacks to the Focus block card, and the Night ritual says "พรุ่งนี้สอบ นอนให้พอนะ".
   - The day after the exam: a short "you did it" scene.

Later, if the orders feel flat: a **hornbill postman** NPC who brings the daily orders, as a one-line scene per order.

## Som's café (Minnie OK 2026-11-12)
Most students and office workers drink coffee in the morning or afternoon, so the café ties the app to real life. Nothing about it is daily or required.

- **Orders are a game first. Real life is a short question right after the order** (Minnie, 2026-11-12).
  - **Café (game):** order anything, any time. Som brews it, and every order gets the cup art and a stamp. At 10 stamps you get a café decor item. Stamps never expire and don't need to be consecutive.
  - **Right after an order, a small popup asks:** "ในชีวิตจริงกินด้วยไหม?" with three answers:
    - **ใช่** records a real coffee at the order's time.
    - **ทีหลัง** asks again once in the Night ritual: "วันนี้กินกาแฟจริงไหม? ไม่ได้กิน / เช้า / บ่าย / เย็น".
    - **เล่นเฉยๆ** records nothing and asks nothing tonight.
    - Closing the popup counts as ทีหลัง.
  - **Asked at most once a day.** After any answer, later orders that day don't ask again (a second real cup can be added from the cup's sheet).
  - **"ใช้ร้านกาแฟแค่ในเกม"** in Settings turns the question off completely.
- **Menu:** Americano, latte, Thai iced coffee, Thai tea, matcha, cocoa, jasmine tea, water. Decaf and no-caffeine drinks earn the same stamps, so nothing nudges anyone towards more caffeine.
- **Data quality:**
  - Real coffee comes only from these explicit answers.
  - A day with no answer, or only "เล่นเฉยๆ", is *left out*; it is never counted as "no coffee" unless the bedtime answer says ไม่ได้กิน.
  - The insight uses only answered days.
- **Sleep insight (Stats):** "วันที่กินกาแฟบ่าย/เย็น คุณเข้านอนช้าลงเฉลี่ย ~35 นาที (จาก 9 กับ 11 วัน)".
  - It is shown only with about 8 or more answered days on each side.
  - It is worded as "ดูเหมือนว่า…" and never claims cause.
  - Bedtimes come from Goodnight.
- **Farm link (M13):** brew menu items from your own produce (coffee beans + cow's milk → latte, strawberries + milk → strawberry latte) and sell or deliver them.
- **Story:** the café opens with a short scene at Farmhouse level 2, and a barista outfit for Som later joins the wardrobe.

## Sound (Minnie OK 2026-11-12)
The game already has: tick/untick, the first-10 pop, harvest, capsule shake/crack/jingle (pitch rises with rarity), animal sounds, and the phone-timer chime.

Five signature sounds to add, all short, all under the global mute:
1. "I'm up": a bright sunrise chime.
2. Goodnight: a 2-second lullaby.
3. Coins earned: a coin clink, separate from the harvest sound.
4. A streak milestone or welcome back: a soft celebration.
5. Som: a meow in cutscenes and when petted.

**Auto-quiet:** sounds turn themselves off during the Focus and Work blocks (class, office) and come back after. The planner side stays quiet.

**Build order:** the five sounds and auto-quiet ship with the Som story work. The real-life café comes after the story; brewing from produce comes with M13.
