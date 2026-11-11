import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setAllTemplates, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { gotoToday, wakeDay, leaveAfterSignIn } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, zonedInstant } from "@/lib/time";

/** M6 farm: plant a seed, watch it ripen from real check-ins, harvest it (server-checked). */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function setup(page: Page) {
  const email = uniqueEmail("farm");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  return id;
}

test("CJ-M6-1 plant a starter seed in an empty plot (2 taps, pictures)", async ({ page }) => {
  const id = await setup(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "Focus: empty" }).click();
  const sheet = page.getByRole("dialog", { name: "Plant in Focus" });
  await sheet.getByRole("button", { name: "Radish" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Focus: Radish, day 0 of 1" })).toBeVisible();
  expect(await rest(`plots?user_id=eq.${id}&slot=eq.focus&select=crop_id`)).toEqual([{ crop_id: "radish" }]);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
});

test("CJ-M6-2 a crop that grew yesterday is ripe: harvest it, the produce is kept, the plot empties", async ({
  page,
}) => {
  const id = await setup(page);
  const today = wakeDay();
  const yesterday = addDays(today, -1);
  await rest(`plots?user_id=eq.${id}&slot=eq.focus`, {
    method: "PATCH",
    body: JSON.stringify({ crop_id: "radish", planted_on: addDays(today, -2), state: "growing" }),
  });
  // Yesterday's Focus started on time (written as a live check-in).
  await rest("block_logs", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      date: yesterday,
      block: "focus",
      planned_start: zonedInstant(yesterday, 12 * 60, "Asia/Bangkok").toISOString(),
      started_at: zonedInstant(yesterday, 12 * 60 + 4, "Asia/Bangkok").toISOString(),
    }),
  });
  await page.goto("/farm");
  await page.getByRole("button", { name: "Focus: Radish, ready to harvest" }).click();
  await page.getByRole("dialog", { name: "Focus" }).getByRole("button", { name: "Harvest" }).click();
  await expect(page.getByRole("button", { name: "Focus: empty" })).toBeVisible();
  // Produce only: setting sleep times (setAllTemplates) also pays its setup reward in seeds.
  expect(await rest(`inventory?user_id=eq.${id}&item_id=like.crop:*&select=item_id,qty`)).toEqual([
    { item_id: "crop:radish:normal:100", qty: 1 },
  ]);
});

test("CJ-M6-3 an unripe crop has no Harvest; replacing it asks first", async ({ page }) => {
  const id = await setup(page);
  await rest(`plots?user_id=eq.${id}&slot=eq.work`, {
    method: "PATCH",
    body: JSON.stringify({ crop_id: "carrot", planted_on: wakeDay(), state: "growing" }),
  });
  await page.goto("/farm");
  await page.getByRole("button", { name: "Work: Carrot, day 0 of 1" }).click();
  const sheet = page.getByRole("dialog", { name: "Work" });
  await expect(sheet.getByRole("button", { name: "Harvest" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Replace" }).click();
  await expect(sheet.getByText("Replace Carrot?")).toBeVisible();
  await sheet.getByRole("button", { name: "Lettuce" }).click();
  await expect(page.getByRole("button", { name: "Work: Lettuce, day 0 of 1" })).toBeVisible();
});

test("CJ-07 step 3: one tap plants tomorrow's seeds in every empty plot (SPEC §4.1)", async ({ page }) => {
  const id = await setup(page);
  await setWakeMinutesAgo(id, 910); // Down Time: the ritual opens by itself
  await page.goto("/today");
  const sheet = page.getByRole("dialog", { name: "Night ritual" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Next" }).click();
  await sheet
    .getByRole("region", { name: "Same reason for all" })
    .getByRole("button", { name: "Sleepy" })
    .click();
  await sheet.getByRole("button", { name: "Next" }).click();
  await expect(sheet.getByText("Step 3 of 4")).toBeVisible();
  await sheet.getByRole("button", { name: "Plant Carrot in 7 empty plots" }).click();
  await expect(sheet.getByText("Planted in 7 plots", { exact: false })).toBeVisible();
  await expect
    .poll(async () => (await rest(`plots?user_id=eq.${id}&select=crop_id`)) as { crop_id: string }[])
    .toEqual(Array(7).fill({ crop_id: "carrot" }));
});

test("R2: a plot one miss from dying says so, on Today and in its sheet (playtest R1)", async ({ page }) => {
  const id = await setup(page);
  const today = wakeDay();
  await rest(`plots?user_id=eq.${id}&slot=eq.focus`, {
    method: "PATCH",
    body: JSON.stringify({ crop_id: "sunflower", planted_on: addDays(today, -6), state: "growing" }),
  });
  // Four days the app was used (Work started on time) but Focus was skipped; yesterday away.
  for (let i = 5; i >= 2; i--) {
    const d = addDays(today, -i);
    await rest("block_logs", {
      method: "POST",
      body: JSON.stringify({
        user_id: id,
        date: d,
        block: "work",
        planned_start: zonedInstant(d, 13 * 60, "Asia/Bangkok").toISOString(),
        started_at: zonedInstant(d, 13 * 60 + 3, "Asia/Bangkok").toISOString(),
      }),
    });
  }
  await gotoToday(page);
  const line = page.getByRole("link", { name: /Sunflower in Focus: one more miss/ });
  await expect(line).toBeVisible();
  await line.click();
  await expect(page).toHaveURL(/\/farm/);
  await page.getByRole("button", { name: /^Focus: Sunflower/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Focus" }).getByText(/One more missed Focus and it dies/),
  ).toBeVisible();
});
