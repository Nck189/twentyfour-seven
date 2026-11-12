import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, setAllTemplates, userIdFor } from "../helpers/db";
import { dismissNightOffer, gotoToday, leaveAfterSignIn } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";
import { seasonOf } from "@/content/seasons";
import { addDays, localDate, zonedInstant } from "@/lib/time";

/** M9 streak, unlocks and seasons (SPEC §8.7, §8.8, §8.8b): settled and paid by the server. */
test.skip(IS_PROD_RUN, "creates dedicated users");

const TZ = "Asia/Bangkok";

async function setup(page: Page) {
  const email = uniqueEmail("streak");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  return id;
}

/** The server's wake-day with a 10:00 wake (before it, the day is still yesterday). */
function wakeDay(now = new Date()): string {
  const d = localDate(now, TZ);
  return now < new Date(zonedInstant(d, 600, TZ)) ? addDays(d, -1) : d;
}

/** n good days (live in-window "I'm up" + Night ticket) ending the wake-day before this one. */
async function goodDays(id: string, n: number) {
  const last = addDays(wakeDay(), -1);
  const first = addDays(last, -(n - 1));
  await rest(`profiles?user_id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ created_at: zonedInstant(first, 6 * 60, TZ).toISOString() }),
  });
  const days = Array.from({ length: n }, (_, i) => addDays(first, i));
  await rest("wake_events", {
    method: "POST",
    body: JSON.stringify(
      days.map((d) => ({
        user_id: id,
        date: d,
        target_wake: zonedInstant(d, 600, TZ).toISOString(),
        pressed_at: zonedInstant(d, 602, TZ).toISOString(),
        in_window: true,
        backfilled: false,
      })),
    ),
  });
  await rest("ticket_grants", {
    method: "POST",
    body: JSON.stringify(days.map((d) => ({ user_id: id, reason: "night", ref_date: d, amount: 1 }))),
  });
}

test("CJ-M9-1 seven good days: streak 7, +5 tickets, a scarecrow, and the 7-day unlock hatches an egg", async ({
  page,
}) => {
  test.slow();
  const id = await setup(page);
  await goodDays(id, 7);
  await gotoToday(page);
  // The 7 days end yesterday (by wake-day, whatever the clock): streak 7 and one scarecrow held.
  const chip = page.getByRole("button", { name: "Streak: 7 days" });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "7 days in a row" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Unlocked!" })).toBeVisible();
  await chip.click();
  const sheet = page.getByRole("dialog", { name: "Streak" });
  await expect(sheet.getByText("7 days in a row")).toBeVisible();
  await expect(sheet.getByRole("img", { name: "1 scarecrow", exact: true })).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);

  const g = await gameState(id);
  expect(g.streak).toBe(7);
  expect(g.tickets).toBeGreaterThanOrEqual(5);
  const animals = (await rest(`animals?user_id=eq.${id}&select=id`)) as unknown[];
  expect(animals).toHaveLength(1);
  // Settling again pays nothing more.
  await page.reload();
  await dismissNightOffer(page);
  await expect(page.getByRole("button", { name: "Streak: 7 days" })).toBeVisible({ timeout: 15_000 });
  expect((await gameState(id)).tickets).toBe(g.tickets);
});

test("CJ-M9-2 the collection book shows progress; the first Night ritual unlocks the garden lantern", async ({
  page,
}) => {
  const id = await setup(page);
  await rest("ticket_grants", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      reason: "night",
      ref_date: addDays(localDate(new Date(), TZ), -1),
      amount: 1,
    }),
  });
  await page.goto("/farm");
  await page.getByRole("button", { name: /^Collection/ }).click();
  const book = page.getByRole("dialog", { name: "Collection" });
  await expect(book.getByRole("region", { name: "First steps" })).toBeVisible();
  await expect(book.getByText("First Night ritual").locator("..")).toContainText("Unlocked");
  await expect(book.getByText("A 30-day streak").locator("..")).toContainText("30 more");
  await expectNoSeriousA11y(page);
  const decor = (await rest(`decor?user_id=eq.${id}&select=item_id`)) as { item_id: string }[];
  expect(decor.map((d) => d.item_id)).toContain("garden_lantern");
});

test("CJ-M9-3 this month's season banner; a festival month sells its item", async ({ page }) => {
  await setup(page);
  await page.goto("/farm");
  // The app and the shop both go by the wake-day (the 1st before wake is still last month).
  const season = seasonOf(wakeDay());
  await expect(page.getByRole("region", { name: /^This month: / })).toBeVisible();
  // Decor lives in the farm Shop's "Shop" tab (economy v2).
  await page.getByRole("region", { name: "Shop" }).getByRole("radio", { name: "Shop", exact: true }).click();
  const shop = page.getByRole("region", { name: "Decor" });
  if (season.festival) await expect(shop.getByText("This month")).toBeVisible();
  else await expect(shop.getByText("This month")).toHaveCount(0);
});
