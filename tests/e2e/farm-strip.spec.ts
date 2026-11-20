import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y } from "../helpers/a11y";
import { setPrefs, settle, signIn, uniqueEmail } from "../helpers/auth";
import { dismissNightOffer } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/** Review fix C3: the farm on Today (phones), from the farm load Today already makes. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("phones: Today shows the 7 plots in day order and opens the farm; the farm is read once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, uniqueEmail("strip"));
  const plotReads: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/plots")) plotReads.push(r.url());
  });
  await page.goto("/today");
  await dismissNightOffer(page);
  const strip = page.getByRole("link", { name: "Your farm: open it" });
  await expect(strip).toBeVisible({ timeout: 15_000 });
  const plots = strip.locator("[data-plot]");
  await expect(plots).toHaveCount(7);
  expect(await plots.evaluateAll((els) => els.map((e) => e.getAttribute("data-plot")))).toEqual([
    "wake",
    "focus",
    "work",
    "gradation",
    "free",
    "down",
    "sleep",
  ]);
  await settle(page);
  // The strip and the "one miss from dying" line share one read (no extra request on Today).
  expect(plotReads.length).toBeLessThanOrEqual(2); // the first read, plus at most its one quiet retry
  await expectNoSeriousA11y(page);
  await strip.click();
  await expect(page).toHaveURL(/\/farm$/);
});

test("iPad and Mac: no strip (the farm is in the side panel)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, uniqueEmail("strip-lg"));
  await page.goto("/today");
  await dismissNightOffer(page);
  await settle(page);
  await expect(page.getByRole("link", { name: "Your farm: open it" })).toBeHidden();
});
