import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, userIdFor } from "../helpers/db";
import { gotoToday } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/** First-time tips (BUILD_PLAN M10): one bubble at a time, each once per account, skippable. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("CJ-M10-2 a tip shows once, one at a time; Skip all turns them off; More brings them back", async ({
  page,
}) => {
  const email = uniqueEmail("tips");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email, { tips: true });
  const id = await userIdFor(email);
  await page.goto("/plan");
  const tip = page.getByRole("complementary", { name: "Tip" });
  await expect(tip).toHaveCount(1);
  await expect(tip).toContainText("Plan any day here");
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await tip.getByRole("button", { name: "Got it" }).click();
  await expect(tip).toHaveCount(0);
  // Seen: it doesn't come back, here or on another device (kept on the account).
  await expect
    .poll(
      async () =>
        ((await rest(`profiles?user_id=eq.${id}&select=tips_seen`)) as { tips_seen: string[] }[])[0]!
          .tips_seen,
    )
    .toContain("plan");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plan", level: 1 })).toBeVisible();
  await expect(tip).toHaveCount(0);

  // Another screen shows its own tip; "Skip all tips" turns every tip off.
  // (At Down Time the Night ritual opens over Today by itself: close it first.)
  await gotoToday(page);
  await expect(tip).toHaveCount(1);
  await tip.getByRole("button", { name: "Skip all tips" }).click();
  await expect(tip).toHaveCount(0);
  await page.goto("/farm");
  await expect(page.getByRole("heading", { name: "Farm", level: 1 })).toBeVisible();
  await expect(tip).toHaveCount(0);

  // More → Show tips again.
  await page.goto("/more");
  // A tap before the page is interactive does nothing; tap again until it answers (CI WebKit).
  await expect(async () => {
    await page.getByRole("button", { name: "Show tips again" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Tips are back on." })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  // "Back on" only shows once the account has saved it (CI 2026-11-12: leaving at once lost it).
  expect(
    (
      (await rest(`profiles?user_id=eq.${id}&select=tips_seen,tips_off`)) as {
        tips_seen: string[];
        tips_off: boolean;
      }[]
    )[0],
  ).toEqual({ tips_seen: [], tips_off: false });
  await page.goto("/plan");
  await expect(tip).toContainText("Plan any day here");
});
