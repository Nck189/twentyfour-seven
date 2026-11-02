import { expect, test } from "@playwright/test";
import { setPrefs, signIn } from "../helpers/auth";
import { fixClock } from "../helpers/clock";

/**
 * G3 visual matrix: every screen × light/dark × EN/TH on every WebKit project.
 * Baselines live in tests/visual/__snapshots__; copies go to screenshots/ for the rubric review.
 */
const MILESTONE = process.env.QC_MILESTONE ?? "M0";
const SCREENS = ["today", "plan", "farm", "stats", "more"] as const;
const COMBOS = [
  { locale: "en", theme: "light" },
  { locale: "en", theme: "dark" },
  { locale: "th", theme: "light" },
  { locale: "th", theme: "dark" },
] as const;

for (const { locale, theme } of COMBOS) {
  test.describe(`${locale}-${theme}`, () => {
    test.use({ colorScheme: theme });

    test("login", async ({ page }, info) => {
      await fixClock(page);
      await setPrefs(page, { locale, theme });
      await page.goto("/login");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${MILESTONE}-login-${info.project.name}-${locale}-${theme}.png`,
      });
      await expect(page).toHaveScreenshot(`login-${locale}-${theme}.png`);
    });

    test("app screens", async ({ page }, info) => {
      await fixClock(page);
      await setPrefs(page, { locale, theme });
      await signIn(page);
      for (const s of SCREENS) {
        await page.goto(`/${s}`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400); // let hydration-driven transitions settle
        // Account email differs per run; hide it for stable baselines.
        const mask = s === "more" ? [page.getByText(/@test\.local/)] : [];
        await page.screenshot({
          path: `screenshots/${MILESTONE}-${s}-${info.project.name}-${locale}-${theme}.png`,
          mask,
        });
        await expect(page).toHaveScreenshot(`${s}-${locale}-${theme}.png`, { mask });
      }
    });
  });
}
