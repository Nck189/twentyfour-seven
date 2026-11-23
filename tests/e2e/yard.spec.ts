import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, userIdFor } from "../helpers/db";
import { leaveAfterSignIn } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/** Farm yard (Minnie 2026-11-23, docs/FARM_YARD_PLAN.md): decor you place, move and put away. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("decor stands in the yard; Move to… moves and swaps it, Put away stores it, and it comes back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = uniqueEmail("yard");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  // Two items, as if bought: the server gives them spots 1 and 2.
  for (const item_id of ["fence", "flowers"])
    await rest("decor", { method: "POST", body: JSON.stringify({ user_id: id, item_id }) });
  await page.goto("/farm");
  const yard = page.getByRole("region", { name: "Farm yard" });
  await expect(yard.getByRole("button", { name: "Fence in spot 1: tap to move or put away" })).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);

  // Move the fence onto the flowers' spot: they swap (no drag needed).
  await yard.getByRole("button", { name: /^Fence in spot 1/ }).click();
  const sheet = page.getByRole("dialog", { name: "Fence" });
  await sheet.getByRole("button", { name: "Move to spot 2 (swaps with Flowers)" }).click();
  await expect(yard.getByRole("button", { name: /^Fence in spot 2/ })).toBeVisible();
  await expect(yard.getByRole("button", { name: /^Flowers in spot 1/ })).toBeVisible();

  // Put the flowers away: they wait in storage, and an empty spot offers to take them back.
  await yard.getByRole("button", { name: /^Flowers in spot 1/ }).click();
  await page.getByRole("dialog", { name: "Flowers" }).getByRole("button", { name: "Put away" }).click();
  const storage = page.getByRole("region", { name: "In storage (1)" });
  await expect(storage.getByRole("button", { name: "Flowers in storage: tap to place" })).toBeVisible();
  await yard.getByRole("button", { name: "Empty spot 6" }).click();
  await page
    .getByRole("dialog", { name: "Empty spot 6" })
    .getByRole("button", { name: "Place Flowers in spot 6" })
    .click();
  await expect(yard.getByRole("button", { name: /^Flowers in spot 6/ })).toBeVisible();
  expect(
    (await rest(`decor?user_id=eq.${id}&select=item_id,spot&order=created_at`)) as {
      item_id: string;
      spot: number;
    }[],
  ).toEqual([
    { item_id: "fence", spot: 2 },
    { item_id: "flowers", spot: 6 },
  ]);
});
