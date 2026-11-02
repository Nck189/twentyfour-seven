import { expect, test } from "@playwright/test";
import { setPrefs, signIn } from "../helpers/auth";

/** G6 production smoke: login → Today → check-in → Farm. Safe to run on prod (smoke account only). */
test("smoke: login → today → check-in → farm", async ({ page }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page);
  // At Down Time the Night ritual opens by itself and covers Today: close it first.
  const showDay = page.getByRole("button", { name: "See the whole day" });
  const ritual = page.getByRole("dialog", { name: "Night ritual" });
  await expect(showDay.or(ritual)).toBeVisible();
  if (await ritual.isVisible()) await ritual.getByRole("button", { name: "Close", exact: true }).click();
  await showDay.click();
  await expect(page.getByRole("list", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Today" }).getByRole("listitem")).toHaveCount(7);
  const card = page.getByRole("region", { name: "Current block" });
  await expect(card).toBeVisible();
  const start = card.getByRole("button", { name: "Start", exact: true });
  if (await start.isVisible()) {
    await start.click();
    await expect(card.getByText(/Started \d\d:\d\d/)).toBeVisible();
  } else {
    await expect(card.getByText(/Started \d\d:\d\d|Closed \d\d:\d\d/).first()).toBeVisible();
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .filter({ visible: true })
    .getByRole("link", { name: "Farm" })
    .click();
  await expect(page).toHaveURL(/\/farm$/);
});
