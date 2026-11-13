import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { IS_PROD_RUN } from "../helpers/env";

/**
 * M11 notifications (SPEC §9): More → Notifications. Without a VAPID key in the build the card
 * says "coming soon" and asks for nothing (permission is only ever asked after a tap).
 */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("CJ-PUSH-1 More shows Notifications; nothing is asked without a tap", async ({ page }) => {
  let asked = false;
  await page.exposeFunction("__asked", () => (asked = true));
  await page.addInitScript(() => {
    const orig = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = (...a: Parameters<typeof orig>) => {
      (window as unknown as { __asked: () => void }).__asked();
      return orig(...a);
    };
  });
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, uniqueEmail("push"));
  await page.goto("/more");
  const card = page.locator("#notifications");
  await expect(card.getByRole("heading", { name: "Notifications" })).toBeVisible();
  // Every state is a plain sentence: coming soon (no VAPID key), Turn on, blocked, unsupported, or
  // (iPhone/iPad Safari tab) add to the Home Screen first.
  await expect(card).toContainText(/coming soon|Turn on notifications|blocked|can't show|Home Screen/);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await page.goto("/today");
  await page.waitForTimeout(500);
  expect(asked).toBe(false);
});
