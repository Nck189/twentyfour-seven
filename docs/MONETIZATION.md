# Paying for extras: a plan, not built (Minnie, 2026-11-12)

Minnie: "Plan for letting people top up money later to trade for things. Don't build it yet. It must not break the game for free players, but should make people want to top up."

## Rules that never bend
1. **Money never buys the habit.** It buys no streaks, no "minimum days", no Day score, and no growth, quality or tickets that are earned by living the day. The app's core promise is that the farm reflects your real day, and money would break that.
2. **No pay-to-win and no paid randomness.**
   - Gacha tickets are never sold for money, and capsules stay earned-only.
   - Everything paid is shown before you buy it: no loot boxes. That also avoids the odds-disclosure and loot-box rules in several countries.
3. **A free player can earn every gameplay item.** Paying buys extra looks, variety and comfort, never a better farm.
4. **No ads, no dark patterns.**
   - Nothing like "only 2 h left! Buy now!", and no fake discounts.
   - No nagging popups. The shop is somewhere you go, not something that comes to you.
5. **Kind to students:** small prices, one-time purchases, and a subscription that's easy to cancel.

## What people would want to pay for
Built on what only 24/7 has: Som, the farm's life sim, Thai seasons, and a planner that knows your real day. Minnie noted on 2026-11-12 that generic "focus app" items (tree species, sound packs) feel like Forest, so they're left out.

| # | Product | What it is | Why people pay | Price idea (THB) |
|---|---|---|---|---|
| 1 | **Seasonal Farm Pass** (monthly) | Each month's seasonal crop (STORY.md) has a free reward track that everyone gets. The paid track adds cosmetic variants: a golden-petal Candle Lotus, Som's Loy Krathong outfit, a themed stall skin. Progress comes from **minimum days**, so the pass *rewards the habit* rather than replacing it. | It renews every month with the story, and the collection keeps growing. | 59–79 / month |
| 2 | **Som's wardrobe** | Outfits for Som (raincoat, school uniform for exam week, chef hat), shown in cutscenes and on the farm. | Attachment to the companion. | 29–49 each |
| 3 | **Som's house: rooms and furniture** | The farmhouse (economy upgrade) opens inside: a reading nook, a kitchen and a sleeping corner, where Som naps in your furniture. | A cozy home, and Som visibly uses it. | 35–99 per set |
| 4 | **Thai farm themes** | Whole-farm looks tied to Thai places: a Doi mountain farm with mist, a canal farm with boats, a riverside night market. | Self-expression with a local feel no other app has. | 69–99 |
| 5 | **Story-card frames** | Your weekly summary and year in review as an IG-story-sized card, with paid frames and Som stickers. The basic frame is free. | People already share "insights"; this makes sharing pretty. | 29–39 |
| 6 | **Visiting friends** | Cosmetic visitors that wander the farm: a hornbill postman, a baby elephant, a pair of sparrows. No gameplay. | Collectible life on the farm. | 39–59 |
| 7 | **Supporter** (optional subscription) | Includes the Farm Pass and one wardrobe item a month, plus a small "ผู้สนับสนุน" leaf on your farm sign and a thank-you scene with Som. | Supporting a small indie student project. | 79 / month |
| 8 | **Gift to a friend** (with M12 sharing) | Buy a wardrobe item or a visitor for a friend's farm. | Social, and a cheap birthday gift. | the item's price |

**Not sold:**
- tickets;
- coins: selling coins would let money buy upgrades and orders. Coins stay earned;
- extra plots or growth speed;
- streak protection beyond what free players get (the scarecrow stays earned);
- a share of the story chapters: story is free for everyone. The Pass adds only cosmetic variants.

## How it would work (when it's time)
- **Payments:** web checkout through Stripe or Omise, with PromptPay and cards for Thailand. As a PWA this needs no App Store in-app purchase. If we ship a native iOS app later, App Store rules apply and this section changes.
- **Server-side only, like the economy:**
  - A payment webhook writes `purchases` (own-row RLS) and grants items through a `security definer` function.
  - The client never grants anything.
  - Refunds revoke the item.
- **The shop UI** is a new "พิเศษ / Extras" tab in the farm Shop that shows exactly what you get. Purchases are kept separate from the coin shop so the two never mix.
- **Legal:**
  - Thai consumer law and PDPA: privacy notice, purchase records, refunds.
  - Under-18s: no subscriptions without a parent's agreement, or keep the subscription 18+.
  - Prices shown with VAT.

## When
- **After** the closed beta proves people come back (see the beta KPIs). Selling to people who don't stay is wasted effort.
- **Order:** the story and seasonal crops first, since the free track needs them. Then Som's wardrobe, the Farm Pass and story-card frames. Rooms, themes and visitors later.
