import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { setChecklist, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { dismissNightOffer } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";
import { localDate } from "@/lib/time";

/** Review fix C1 (GROWTH G1): a new account's first day keeps to one thing to do. */
test.skip(IS_PROD_RUN, "creates dedicated users");
const crossesMidnight = (minutesAgo: number) =>
  localDate(new Date(Date.now() - minutesAgo * 60_000), "Asia/Bangkok") !==
  localDate(new Date(), "Asia/Bangkok");

async function account(page: import("@playwright/test").Page, newAccount: boolean) {
  const email = uniqueEmail(newAccount ? "first-day" : "day-two");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email, { newAccount });
  const id = await userIdFor(email);
  // Today's wake was 150 min ago: before this new account existed.
  await setWakeMinutesAgo(id, 150);
  await setChecklist(id, "work", ["Alpha"]);
  await page.goto("/today");
  await dismissNightOffer(page);
  return id;
}

test("signed up after today's wake: no 'I'm up' to press, tomorrow's instead; the rest waits folded", async ({
  page,
}) => {
  test.skip(crossesMidnight(150), "today's wake would be yesterday's date");
  await account(page, true);
  await expect(
    page.getByText(/^Tomorrow: tap “I'm up” the moment you leave the bed \(target \d\d:\d\d\)\.$/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /I'm up/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Current block" })).toBeVisible();
  // Exercise and the whole day wait under one closed disclosure.
  await expect(page.getByRole("region", { name: "Exercise" })).toBeHidden();
  await page.getByText("Everything else today").click();
  await expect(page.getByRole("region", { name: "Exercise" })).toBeVisible();
  await expect(page.getByRole("button", { name: "See the whole day" })).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
});

test("from the second day, Today is the everyday screen", async ({ page }) => {
  test.skip(crossesMidnight(150), "today's wake would be yesterday's date");
  await account(page, false);
  await expect(page.getByRole("button", { name: /I'm up/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Exercise" })).toBeVisible();
  await expect(page.getByText("Everything else today")).toHaveCount(0);
});
