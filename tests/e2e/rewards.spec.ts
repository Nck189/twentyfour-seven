import { expect, test, type Page } from "@playwright/test";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setAllTemplates, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { dismissNightOffer, leaveAfterSignIn, wakeDay } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, localDate, zonedInstant } from "@/lib/time";

/** Review fix F2: small animations where a reward lands; reduced motion shows the end state at once. */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function radishThatRipensOnReload(page: Page) {
  const email = uniqueEmail("grow");
  await setPrefs(page, { locale: "en", theme: "light", animations: true });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  const today = wakeDay();
  await rest(`plots?user_id=eq.${id}&slot=eq.focus`, {
    method: "PATCH",
    body: JSON.stringify({ crop_id: "radish", planted_on: addDays(today, -2), state: "growing" }),
  });
  // First visit: the radish as a seed (this device remembers that).
  await page.goto("/farm");
  await expect(page.getByRole("button", { name: "Focus: Radish, day 0 of 1" })).toBeVisible();
  await page.waitForTimeout(600);
  // Yesterday's Focus happened: the next visit finds it ripe.
  const yesterday = addDays(today, -1);
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
  await page.reload();
  return page.getByRole("button", { name: "Focus: Radish, ready to harvest" });
}

test("F2: a crop that grew since the last visit steps up once", async ({ page }) => {
  const plot = await radishThatRipensOnReload(page);
  await expect(plot).toHaveAttribute("data-grew", "true");
  await expect(plot).toHaveClass(/grow-step/);
  // Once: the next visit has nothing new.
  await page.waitForTimeout(600);
  await page.reload();
  await expect(plot).toBeVisible();
  await page.waitForTimeout(600);
  await expect(plot).not.toHaveAttribute("data-grew", "true");
});

test("F2 with reduced motion: the grown plot is shown in place at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const plot = await radishThatRipensOnReload(page);
  await expect(plot).toHaveAttribute("data-grew", "true");
  const transform = await plot.evaluate((el) => getComputedStyle(el).transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  await expect(plot).toBeInViewport();
});

test("F2: finishing a block on Today makes its plot on the farm strip bounce", async ({ page }) => {
  test.skip(
    localDate(new Date(Date.now() - 100 * 60_000), "Asia/Bangkok") !== localDate(new Date(), "Asia/Bangkok"),
    "today's wake would be yesterday's date",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const email = uniqueEmail("strip-bounce");
  await setPrefs(page, { locale: "en", theme: "light", animations: true });
  await signIn(page, email);
  await setWakeMinutesAgo(await userIdFor(email), 100); // Focus is current
  await page.goto("/today");
  await dismissNightOffer(page);
  const card = page.getByRole("region", { name: "Current block" });
  await card.getByRole("button", { name: "Start" }).click();
  const strip = page.getByRole("link", { name: "Your farm: open it" });
  await expect(strip).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "Finish block" }).click();
  await expect(strip.locator('[data-plot="focus"]')).toHaveClass(/grow-step/);
});
