import type { Page } from "@playwright/test";
import { addDays, localDate, localParts } from "@/lib/time";

/**
 * The wake-day right now when every template wakes at `wakeMin` (default 10:00): a day runs
 * wake → next wake, so before the wake it's still yesterday's day (Plan's "Today").
 */
export function wakeDay(wakeMin = 10 * 60, tz = "Asia/Bangkok"): string {
  const now = new Date();
  const p = localParts(now, tz);
  const cal = localDate(now, tz);
  return p.hour * 60 + p.minute < wakeMin ? addDays(cal, -1) : cal;
}

/**
 * During Down Time the Night ritual opens by itself over Today (by design, SPEC §4.4). Tests that
 * use Today for something else close it first, so they pass at any hour CI happens to run.
 */
export async function dismissNightOffer(page: Page) {
  const ritual = page.getByRole("dialog", { name: "Night ritual" });
  await ritual.waitFor({ state: "visible", timeout: 2_000 }).catch(() => {});
  if (await ritual.isVisible()) await ritual.getByRole("button", { name: "Close", exact: true }).click();
}

/** Opens Today and gets the Night ritual's own offer out of the way (see dismissNightOffer). */
export async function gotoToday(page: Page) {
  await page.goto("/today");
  await dismissNightOffer(page);
}

/**
 * signIn lands on Today, which settles the streak and claims setup rewards on load. A test that
 * then seeds days or templates must let that first load finish and leave, or the load can run
 * after the seed and use it up there (the streak's "7 days in a row", a sleep-times reward).
 */
export async function leaveAfterSignIn(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.goto("about:blank");
}
