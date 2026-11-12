# Economy v2: what coins and produce are for

Minnie OK'd this on 2026-11-11 ("โอเคทุกอย่างที่ถามมา"). Playtest R1 found two problems:
- Harvests had no use.
- Coins had only decor to spend them on, so there was no long-term pull.

Every number below lives in `content/economy.ts`. The server mirrors it in SQL, and tests check the two copies match. Every coin and ticket change happens in a `security definer` RPC.

## Coin sources
| Source | Amount | Limit |
|---|---|---|
| Backlog tasks (existing) | 10 / 20 / 30 | 150 per rolling 24 h |
| **Market**: sell produce | price by rarity × quality × weather (capped) | none (produce is the limit) |
| **Daily orders** | 1.5× the market value of the delivery + 10 | 1–3 orders a day (Barn level) |

## Market (R4)
- **Base price:** common 6, uncommon 10, rare 16, epic 30, legendary 60.
- **Animal produce:** egg 4, wool 6, milk 6, truffle 12. Animal produce has no quality, so only the base price applies.
- **Quality multiplier:** normal ×1, silver ×1.25, gold ×1.5, prismatic ×2.
- **Weather multiplier:** the crop's mutation multiplier, **capped at ×4**.
- **Market stall upgrade:** +10% per level (2 levels).
- **Price** = round(base × quality × min(weather, 4) × stall).
- **Server-side quality:** the server works out quality and weather at harvest (a SQL port of `simulatePlot`; a parity test runs both on the same random weeks). The produce is stored as `crop:<id>:<quality>:<mult×100>`, so a sale can't be inflated by the client.
- **Older stock:** produce harvested before this change (`crop:<id>`) sells as normal quality with no weather.

## Spending
| Sink | Price | Rule |
|---|---|---|
| Decor (existing) | 30–300 | — |
| **Seed shop** | uncommon 30, rare 80 | 3 offers a day (2 uncommon + 1 rare), picked from a hash of (user, wake-day). Commons are free starters. Epic and above come from capsules only, so capsules stay special. |
| **Ticket exchange** | 150 coins = 1 ticket | at most 2 a week (Monday-based, user's timezone) |
| **Upgrades** | see below | one level at a time |
| **My rewards** (reward jar) | the user sets the cost (10–10,000) | only coins are spent; the real-life reward is up to the user |

### Upgrades (tiered, each level shows the next goal)
| Track | Lv 1 | Lv 2 | Lv 3 | Effect |
|---|---|---|---|---|
| Market stall | 200 | 500 | — | +10% sell price per level |
| Barn | 300 | 800 | — | +1 daily order per level (1 → 3) |
| House | 400 | 1,000 | 2,000 | looks only (the farmhouse grows) |

Later:
- Tools and machines come in M13 (Factory).
- Animal treats and themes come in M14.

## Daily orders
- One order a day at Barn Lv 0, up to 3 at Lv 2.
- Each order asks for 1–3 of one crop the user has harvested before, or of a starter crop.
- The orders are picked from a hash of (user, wake-day), so the client and the server agree without storing them.
- **Reward** = round(1.5 × the normal-quality market value of the items) + 10 coins.
- Delivering takes the lowest-quality matching produce first.
- Each order can be filled once (`order_deliveries`, primary key (user, date, slot)).

## Reward jar ("รางวัลของฉัน", Minnie 2026-11-11)
- It isn't prominent: it's a small tab in the Farm shop.
- The first time coins reach 300, one quiet line appears: "เก็บเหรียญไว้แลกรางวัลของตัวเองได้นะ".
- **Data:**
  - `rewards`: own rows, RLS, title ≤ 60 chars, cost 10–10,000.
  - `redeem_reward(id)` spends the coins and logs `reward_redeemed`.
