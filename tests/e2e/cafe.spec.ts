import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setAllTemplates, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { wakeDay } from "../helpers/day";
import { addDays, zonedInstant } from "@/lib/time";

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
  const night = ritual.getByRole("region", { name: "Coffee or tea today in real life? (your latest cup)" });
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
  await sheet.getByRole("button", { name: "Latte" }).click();
  await expect(sheet.getByText("Som made you a Latte. Stamp!")).toBeVisible();
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

test("CJ-CAFE-3 Stats → Sleep: coffee vs bedtime once 8+ answered days on each side, worded as a pattern", async ({
  page,
}) => {
  const id = await setup(page, "cafe-stats");
  await setAllTemplates(id, "10:00");
  const today = wakeDay();
  // 9 days with an evening coffee (Goodnight 23:05), 11 without (22:30), then 2 "just playing" days.
  const days = Array.from({ length: 22 }, (_, i) => addDays(today, -22 + i));
  const late = days.slice(0, 9);
  const other = days.slice(9, 20);
  await rest("coffee_answers", {
    method: "POST",
    body: JSON.stringify([
      ...late.map((day) => ({ user_id: id, day, answer: "yes", slot: "evening" })),
      ...other.map((day, i) => ({ user_id: id, day, answer: "later", slot: i % 2 ? "none" : "morning" })),
      ...days.slice(20).map((day) => ({ user_id: id, day, answer: "play", slot: null })),
    ]),
  });
  await rest("events", {
    method: "POST",
    body: JSON.stringify(
      days.map((d, i) => ({
        user_id: id,
        type: "night_ritual_completed",
        // Late nights count too (a late Goodnight is exactly what the insight looks for).
        payload: { date: d, in_time: i >= 9 },
        at: zonedInstant(d, i < 9 ? 23 * 60 + 5 : 22 * 60 + 30, "Asia/Bangkok").toISOString(),
      })),
    ),
  });

  await page.goto("/stats");
  await page.getByRole("radiogroup", { name: "Stats view" }).getByRole("radio", { name: "Sleep" }).click();
  const card = page.getByRole("region", { name: "Coffee, tea and bedtime" });
  await expect(card).toContainText("you say Goodnight about 35 min later");
  await expect(card).toContainText(
    "From 9 days with afternoon/evening coffee or tea and 11 other days (none, or only in the morning).",
  );
  await expectNoSeriousA11y(page);
});

test("CJ-CAFE-4 water never asks; closing the question counts as 'Later'; a 'Yes' day can add another real cup", async ({
  page,
}) => {
  const id = await setup(page, "cafe-close");
  await page.goto("/farm");
  await page.getByRole("button", { name: /Som's café/ }).click();
  const sheet = page.getByRole("dialog", { name: "Som's café" });
  const ask = sheet.getByRole("region", { name: "Did you have one in real life too?" });
  await sheet.getByRole("button", { name: "Water" }).click();
  await expect(sheet.getByText("Som made you a Water. Stamp!")).toBeVisible();
  await expect(ask).toHaveCount(0);
  await sheet.getByRole("button", { name: "Thai tea" }).click();
  await expect(ask).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await expect
    .poll(() => rest(`coffee_answers?user_id=eq.${id}&select=answer,drink`))
    .toEqual([{ answer: "later", drink: "thai_tea" }]);

  const v = await setup(page, "cafe-cup");
  await page.goto("/farm");
  await page.getByRole("button", { name: /Som's café/ }).click();
  await sheet.getByRole("button", { name: "Americano" }).click();
  await ask.getByRole("button", { name: "Yes" }).click();
  await expect(sheet.getByText("Noted. Enjoy!")).toBeVisible();
  await sheet.getByRole("button", { name: "I had another real one" }).click();
  await expect(sheet.getByText(/Noted\. Latest real cup: (Morning|Afternoon|Evening)\./)).toBeVisible();
  await expectTouchTargets(page);
  expect(await rest(`coffee_answers?user_id=eq.${v}&select=answer`)).toEqual([{ answer: "yes" }]);
});
