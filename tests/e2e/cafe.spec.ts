import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/**
 * Som's café (docs/STORY.md): with the Farmhouse at level 2, order a drink for a stamp; right after
 * it, "in real life too?" (yes / later / just playing); "later" is asked once more in the Night
 * ritual; More → "use the café in the game only" never asks.
 */
test.skip(IS_PROD_RUN, "creates dedicated users");

/** Down Time (15h10m after wake): the Night ritual is offered on Today. */
const DOWN_TIME_MINUTES_AFTER_WAKE = 910;

async function setup(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await rest("upgrades", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: id, track: "house", level: 2 }),
  });
  return id;
}

test("CJ-CAFE-1 order a latte for a stamp; 'Later' is asked once at bedtime", async ({ page }) => {
  test.setTimeout(120_000);
  const id = await setup(page, "cafe");
  await setWakeMinutesAgo(id, DOWN_TIME_MINUTES_AFTER_WAKE);

  await page.goto("/farm");
  await page.getByRole("button", { name: /Som's café/ }).click();
  const sheet = page.getByRole("dialog", { name: "Som's café" });
  await expect(sheet.getByLabel("0 of 10 stamps")).toBeAttached();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await sheet.getByRole("button", { name: "Latte" }).click();
  await expect(sheet.getByText("Som made you a Latte. Stamp!")).toBeVisible();
  await expect(sheet.getByLabel("1 of 10 stamps")).toBeAttached();
  const ask = sheet.getByRole("region", { name: "Did you have one in real life too?" });
  await expect(ask).toBeVisible();
  await expectTouchTargets(page);
  await ask.getByRole("button", { name: "Later" }).click();
  await expect(sheet.getByText("OK, I'll ask once at bedtime.")).toBeVisible();
  await expect
    .poll(() => rest(`coffee_answers?user_id=eq.${id}&select=answer,slot`))
    .toEqual([{ answer: "later", slot: null }]);
  // A second order the same day doesn't ask again.
  await sheet.getByRole("button", { name: "Matcha" }).click();
  await expect(sheet.getByText("Som made you a Matcha. Stamp!")).toBeVisible();
  await expect(sheet.getByRole("region", { name: "Did you have one in real life too?" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("2 of 10 stamps")).toBeVisible();

  // Bedtime: the Night ritual's last step asks once.
  await page.goto("/today");
  const ritual = page.getByRole("dialog", { name: "Night ritual" });
  await expect(ritual).toBeVisible();
  for (const n of [2, 3, 4]) {
    await ritual.getByRole("button", { name: "Next" }).click();
    await expect(ritual.getByText(`Step ${n} of 4`)).toBeVisible();
  }
  const night = ritual.getByRole("region", { name: "Coffee today in real life?" });
  await expect(night).toBeVisible();
  await expectTouchTargets(page);
  await night.getByRole("button", { name: "Afternoon" }).click();
  await expect(ritual.getByText("Thanks, noted.")).toBeVisible();
  await expect
    .poll(() => rest(`coffee_answers?user_id=eq.${id}&select=answer,slot`))
    .toEqual([{ answer: "later", slot: "afternoon" }]);
  expect(await rest(`cafe_orders?user_id=eq.${id}&select=drink&order=id`)).toEqual([
    { drink: "latte" },
    { drink: "matcha" },
  ]);
});

test("CJ-CAFE-2 'Use the café in the game only' never asks; the café stays closed below Farmhouse 2", async ({
  page,
}) => {
  const id = await setup(page, "cafe-off");
  await page.goto("/more");
  const toggle = page.getByRole("switch", { name: /Use the café in the game only/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(() => rest(`profiles?user_id=eq.${id}&select=cafe_game_only`))
    .toEqual([{ cafe_game_only: true }]);

  await page.goto("/farm");
  await page.getByRole("button", { name: /Som's café/ }).click();
  const sheet = page.getByRole("dialog", { name: "Som's café" });
  await sheet.getByRole("button", { name: "Cocoa" }).click();
  await expect(sheet.getByText("Som made you a Cocoa. Stamp!")).toBeVisible();
  await expect(sheet.getByRole("region", { name: "Did you have one in real life too?" })).toHaveCount(0);
  expect(await rest(`coffee_answers?user_id=eq.${id}&select=answer`)).toEqual([]);

  // Below Farmhouse level 2 there's no café on the Farm.
  await rest(`upgrades?user_id=eq.${id}&track=eq.house`, {
    method: "PATCH",
    body: JSON.stringify({ level: 1 }),
  });
  await page.goto("/farm");
  await expect(page.getByRole("heading", { name: "Today's weather" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Som's café/ })).toHaveCount(0);
});
