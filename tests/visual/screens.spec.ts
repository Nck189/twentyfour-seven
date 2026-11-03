import { expect, test } from "@playwright/test";
import { setPrefs, signIn } from "../helpers/auth";
import { fixClock } from "../helpers/clock";

/**
 * G3 visual matrix: every screen × light/dark × EN/TH on every WebKit project.
 * Baselines live in tests/visual/__snapshots__; copies go to screenshots/ for the rubric review.
 */
const MILESTONE = process.env.QC_MILESTONE ?? "M4";
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

    test("login paste step, offline, 404", async ({ page }, info) => {
      await fixClock(page);
      await setPrefs(page, { locale, theme });
      await page.addInitScript(() =>
        localStorage.setItem(
          "247-login-pending",
          JSON.stringify({ email: "minnie@example.com", sentAt: Date.now() }),
        ),
      );
      const shots: [string, string][] = [
        ["login-paste", "/login"],
        ["offline", "/offline.html"],
      ];
      for (const [name, url] of shots) {
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `screenshots/${MILESTONE}-${name}-${info.project.name}-${locale}-${theme}.png`,
        });
        await expect(page).toHaveScreenshot(`${name}-${locale}-${theme}.png`, {
          mask: [page.getByRole("button", { name: /\(\d+/ })],
        });
      }
      await signIn(page);
      await page.goto("/nonexistent-page");
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${MILESTONE}-404-${info.project.name}-${locale}-${theme}.png`,
      });
      await expect(page).toHaveScreenshot(`404-${locale}-${theme}.png`);
    });

    test("plan editor and night ritual", async ({ page }, info) => {
      await setPrefs(page, { locale, theme });
      // 23:30 on a Wednesday = Down Time → the ritual opens by itself.
      await fixClock(page, new Date("2026-10-28T23:30:00+07:00"));
      await signIn(page);
      const ritual = page.getByRole("dialog");
      await expect(ritual).toBeVisible();
      await page.getByRole("button", { name: locale === "th" ? "ถัดไป" : "Next" }).click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${MILESTONE}-night-close-${info.project.name}-${locale}-${theme}.png`,
      });
      await expect(page).toHaveScreenshot(`night-close-${locale}-${theme}.png`);
      await page.getByRole("button", { name: locale === "th" ? "ถัดไป" : "Next" }).click();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `screenshots/${MILESTONE}-night-plan-${info.project.name}-${locale}-${theme}.png`,
      });
      await expect(page).toHaveScreenshot(`night-plan-${locale}-${theme}.png`);
      await page.getByRole("button", { name: locale === "th" ? "ปิด" : "Close", exact: true }).click();
      await page.goto("/plan");
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${MILESTONE}-plan-week-${info.project.name}-${locale}-${theme}.png`,
      });
      await expect(page).toHaveScreenshot(`plan-week-${locale}-${theme}.png`);
    });

    // The reveal itself is random (server rolls), so it's covered by CJ-12 + the unit tests instead.
    test("capsule machine and Seed-dex", async ({ page }, info) => {
      await fixClock(page);
      await setPrefs(page, { locale, theme });
      await signIn(page);
      await page.goto("/farm");
      await page.getByRole("button", { name: locale === "th" ? /^ตู้/ : /^Capsule machine/ }).click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${MILESTONE}-capsules-${info.project.name}-${locale}-${theme}.png`,
      });
      await expect(page).toHaveScreenshot(`capsules-${locale}-${theme}.png`);
      await page.getByRole("button", { name: locale === "th" ? "ปิด" : "Close", exact: true }).click();
      await page.getByRole("button", { name: locale === "th" ? /^สมุดเมล็ด/ : /^Seed-dex/ }).click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${MILESTONE}-seeddex-${info.project.name}-${locale}-${theme}.png`,
      });
      await expect(page).toHaveScreenshot(`seeddex-${locale}-${theme}.png`);
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
