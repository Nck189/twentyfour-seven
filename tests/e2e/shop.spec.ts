import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, setAllTemplates, userIdFor } from "../helpers/db";
import { leaveAfterSignIn } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/** Economy v2 (docs/ECONOMY.md): the farm shop, end to end; every number comes from the server. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("shop: sell produce, buy a seed, swap coins for a ticket, upgrade, and a reward of my own", async ({
  page,
}) => {
  const email = uniqueEmail("shop");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  await rest(`game_state?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ coins: 600 }) });
  await rest("inventory", {
    method: "POST",
    body: JSON.stringify({ user_id: id, item_id: "crop:tomato:gold:300", qty: 2 }),
  });
  const before = await gameState(id);

  await page.goto("/farm");
  const shop = page.getByRole("region", { name: "Shop" });
  await expect(shop.getByText("600 coins")).toBeAttached();
  // Market: a gold tomato with ×3 weather sells for 10 × 1.5 × 3 = 45.
  await expect(shop.getByText("Gold · ×3 value")).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shop.getByRole("button", { name: "Sell 1 Tomato for 45 coins" }).click();
  await expect(shop.getByRole("status")).toContainText("+45 coins from the market");
  await expect(shop.getByText("645 coins")).toBeAttached();

  // Shop: a seed of the day (uncommon, 30) and the ticket swap (150).
  await shop.getByRole("radio", { name: "Shop" }).click();
  await shop
    .getByRole("button", { name: /^Buy .* seed for 30 coins$/ })
    .first()
    .click();
  await expect(shop.getByText("615 coins")).toBeAttached();
  await shop.getByRole("button", { name: "Swap" }).click();
  await expect(shop.getByText("1 of 2 left this week")).toBeVisible();
  await expect(shop.getByText("465 coins")).toBeAttached();

  // Upgrades: market stall to level 1 (200).
  await shop.getByRole("radio", { name: "Upgrades" }).click();
  await shop.getByRole("button", { name: "Level 1 · 200" }).first().click();
  await expect(shop.getByText("265 coins")).toBeAttached();

  // My rewards: add one and redeem it.
  await shop.getByRole("radio", { name: "Rewards" }).click();
  await shop.getByLabel("Reward", { exact: true }).fill("Bubble tea");
  await shop.getByLabel("Coins").fill("100");
  await shop.getByRole("button", { name: "Add reward" }).click();
  await shop.getByRole("button", { name: "Redeem Bubble tea for 100 coins" }).click();
  await shop.getByRole("button", { name: "Spend 100 coins" }).click(); // two taps for real savings
  await expect(shop.getByRole("status")).toContainText("Enjoy Bubble tea!");
  await expect(shop.getByText("165 coins")).toBeAttached();
  await expectTouchTargets(page);

  const after = await gameState(id);
  expect(after.coins).toBe(165);
  expect(after.tickets).toBe(before.tickets + 1);
  expect(await rest(`upgrades?user_id=eq.${id}&select=track,level`)).toEqual([{ track: "stall", level: 1 }]);
});
