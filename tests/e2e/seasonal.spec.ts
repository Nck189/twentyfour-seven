import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, setAllTemplates, userIdFor } from "../helpers/db";
import { leaveAfterSignIn } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/**
 * Seasonal crops (docs/STORY.md): the Candle Lotus seed in planting season, ×1.5 and the special
 * order at the seasonal market, and the optional "Float a wish" beat. The server's test clock
 * (`season_clock`, service role only) stands the user on a given day of November.
 */
test.skip(IS_PROD_RUN, "creates dedicated users and sets the server's test clock");

async function setup(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  return id;
}

const setClock = (id: string, today: string) =>
  rest("season_clock", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: id, today }),
  });

test("CJ-SEASON-1 Candle Lotus: its seed in planting season, ×1.5 and the special order at the market", async ({
  page,
}) => {
  const id = await setup(page, "season");
  await rest(`game_state?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ coins: 200 }) });
  await setClock(id, "2026-11-03");

  await page.goto("/farm");
  const shop = page.getByRole("region", { name: "Shop" });
  await expect(shop.getByText("200 coins")).toBeAttached();
  await shop.getByRole("radio", { name: "Shop" }).click();
  const seed = shop.getByRole("region", { name: "Seasonal seed · planting season" });
  await expect(seed.getByText("Candle Lotus")).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await seed.getByRole("button", { name: "Buy Candle Lotus seed for 80 coins" }).click();
  await expect(shop.getByText("120 coins")).toBeAttached();
  expect(await rest(`inventory?user_id=eq.${id}&item_id=eq.seed:candle_lotus&select=qty`)).toEqual([
    { qty: 1 },
  ]);

  // Day 20: the seasonal market. The seed is gone; Candle Lotus sells at 16 × 1.5 = 24.
  await setClock(id, "2026-11-20");
  await rest("inventory", {
    method: "POST",
    body: JSON.stringify({ user_id: id, item_id: "crop:candle_lotus:normal:100", qty: 4 }),
  });
  await page.reload();
  await expect(shop.getByText("120 coins")).toBeAttached();
  const market = shop.getByRole("region", { name: "Seasonal market · Candle Lotus" });
  await expect(market).toBeVisible();
  await expect(shop.getByText("Seasonal market ×1.5")).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await shop.getByRole("button", { name: "Sell 1 Candle Lotus for 24 coins" }).click();
  await expect(shop.getByRole("status")).toContainText("+24 coins from the market");
  await expect(shop.getByText("144 coins")).toBeAttached();
  // The special order: 3 Candle Lotus for 118, once.
  await market.getByRole("button", { name: "Deliver · 118" }).click();
  await expect(shop.getByRole("status")).toContainText("Delivered! +118 coins");
  await expect(market.getByText("Delivered", { exact: true })).toBeVisible();
  expect((await gameState(id)).coins).toBe(262);
  await shop.getByRole("radio", { name: "Shop" }).click();
  await expect(shop.getByRole("region", { name: "Seasonal seed · planting season" })).toHaveCount(0);
});

test("CJ-SEASON-2 Float a wish is optional: Not this time writes nothing; a floated wish stays private", async ({
  page,
}) => {
  const id = await setup(page, "season-wish");
  await setClock(id, "2026-11-20");
  // This year's use beat hasn't played; a Candle Lotus was sold.
  await rest(`story_seen?user_id=eq.${id}&beat=eq.lotus_use:2026`, { method: "DELETE" });
  await rest("events", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      type: "produce_sold",
      payload: { item: "crop:candle_lotus:normal:100", qty: 1, coins: 24 },
    }),
  });

  await page.goto("/farm");
  const scene = page.getByRole("dialog", { name: "Float a wish" });
  await expect(scene).toBeVisible();
  await expect(scene.getByText("Som carries your Candle Lotus down to the water.")).toBeVisible();
  for (let i = 0; i < 2; i++) await scene.getByRole("button", { name: "Next" }).click();
  await expect(scene.getByLabel("Your wish (optional, only you can see it)")).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await scene.getByRole("button", { name: "Not this time" }).click();
  await expect(scene).toHaveCount(0);
  expect(await rest(`wishes?user_id=eq.${id}&select=year`)).toEqual([]);
  expect(await rest(`story_seen?user_id=eq.${id}&beat=eq.lotus_use:2026&select=beat`)).toEqual([
    { beat: "lotus_use:2026" },
  ]);

  // Another day, the beat again (as if not yet seen): this time a wish floats away.
  await rest(`story_seen?user_id=eq.${id}&beat=eq.lotus_use:2026`, { method: "DELETE" });
  await page.reload();
  await expect(scene).toBeVisible();
  for (let i = 0; i < 2; i++) await scene.getByRole("button", { name: "Next" }).click();
  await scene.getByLabel("Your wish (optional, only you can see it)").fill("Sleep before midnight");
  await scene.getByRole("button", { name: "Float it" }).click();
  await expect(scene.getByText(/Your wish drifts away with its tiny flame/)).toBeVisible();
  await scene.getByRole("button", { name: "Done" }).click();
  await expect(scene).toHaveCount(0);
  expect(await rest(`wishes?user_id=eq.${id}&select=year,wish`)).toEqual([
    { year: 2026, wish: "Sleep before midnight" },
  ]);
});

test("G7 STORY-R22: after a wish floats, leaving before Done doesn't replay the scene or show an error", async ({
  page,
}) => {
  const id = await setup(page, "season-wish-r22");
  await setClock(id, "2026-11-20");
  await rest(`story_seen?user_id=eq.${id}&beat=eq.lotus_use:2026`, { method: "DELETE" });
  await rest("events", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      type: "produce_sold",
      payload: { item: "crop:candle_lotus:normal:100", qty: 1, coins: 24 },
    }),
  });
  await page.goto("/farm");
  const scene = page.getByRole("dialog", { name: "Float a wish" });
  for (let i = 0; i < 2; i++) await scene.getByRole("button", { name: "Next" }).click();
  await scene.getByLabel("Your wish (optional, only you can see it)").fill("Read more books");
  await scene.getByRole("button", { name: "Float it" }).click();
  await expect(scene.getByText(/Your wish drifts away with its tiny flame/)).toBeVisible();
  await page.reload(); // left before tapping Done
  await expect(page.getByRole("heading", { name: "Farm", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Float a wish" })).toHaveCount(0);
});

test("CJ-SEASON-3 Snow Strawberry: the year-end cake shows the user's own year in review", async ({
  page,
}) => {
  const id = await setup(page, "season-snow");
  await setClock(id, "2026-12-20");
  await rest(`story_seen?user_id=eq.${id}&beat=eq.snow_use:2026`, { method: "DELETE" });
  await rest("events", {
    method: "POST",
    body: JSON.stringify([
      { user_id: id, type: "harvest", payload: {}, at: "2026-06-01T03:00:00Z" },
      { user_id: id, type: "harvest", payload: {}, at: "2026-09-01T03:00:00Z" },
      {
        user_id: id,
        type: "produce_sold",
        payload: { item: "crop:snow_strawberry:normal:100", qty: 1, coins: 24 },
        at: "2026-12-20T03:00:00Z",
      },
    ]),
  });
  await page.goto("/farm");
  const scene = page.getByRole("dialog", { name: "The year-end cake" });
  await expect(scene).toBeVisible();
  for (let i = 0; i < 2; i++) await scene.getByRole("button", { name: "Next" }).click();
  const review = scene.getByRole("region", { name: "Your 2026" });
  await expect(review).toContainText("2 harvests");
  await expect(review).toContainText("Best streak so far: 0 days");
  await expectNoHorizontalScroll(page);
  await expectTouchTargets(page);
  await scene.getByRole("button", { name: "Next" }).click();
  await scene.getByRole("button", { name: "Done" }).click();
  await expect(scene).toHaveCount(0);
});
