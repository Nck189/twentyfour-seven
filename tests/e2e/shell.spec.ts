import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn } from "../helpers/auth";
import { fixClock } from "../helpers/clock";
import { rest, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, localDate } from "@/lib/time";

const SCREENS = ["today", "plan", "farm", "stats", "more"] as const;

test.describe("app shell", () => {
  let email = "";
  test.beforeEach(async ({ page }) => {
    await fixClock(page);
    await setPrefs(page, { locale: "en", theme: "light" });
    email = await signIn(page);
  });

  test("tab navigation reaches every screen (Stats appears after 3 settled days, SPEC §8.8b)", async ({
    page,
  }) => {
    if (!IS_PROD_RUN) {
      const nav = page.getByRole("navigation", { name: "Main navigation" }).filter({ visible: true });
      await page.goto("/today");
      await expect(nav.getByRole("link", { name: "Today" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Stats" })).toHaveCount(0);
      const id = await userIdFor(email);
      const today = localDate(new Date(), "Asia/Bangkok");
      await rest("day_results", {
        method: "POST",
        body: JSON.stringify(
          [1, 2, 3].map((n) => ({ user_id: id, date: addDays(today, -n - 1), kind: "minimum" })),
        ),
      });
      await page.reload();
    }
    for (const s of SCREENS) {
      const label = s[0].toUpperCase() + s.slice(1);
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .filter({ visible: true })
        .getByRole("link", { name: label })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${s}$`));
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(label);
    }
  });

  test("G4: a11y, touch targets, no horizontal scroll on every screen (EN + TH, light + dark)", async ({
    page,
  }) => {
    test.setTimeout(120_000); // 20 page loads × axe; CI runners are slower
    const labels = { en: "English", th: "ไทย" } as const;
    const themeLabels = {
      en: { light: "Light", dark: "Dark" },
      th: { light: "สว่าง", dark: "มืด" },
    } as const;
    for (const locale of ["en", "th"] as const) {
      for (const theme of ["light", "dark"] as const) {
        await page.goto("/more");
        await page.getByRole("radio", { name: labels[locale] }).click();
        await page.getByRole("radio", { name: themeLabels[locale][theme] }).click();
        for (const s of SCREENS) {
          await page.goto(`/${s}`);
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expectNoSeriousA11y(page);
          await expectTouchTargets(page);
          await expectNoHorizontalScroll(page);
        }
      }
    }
  });

  test("CJ-14 language toggle switches EN/TH, persists across reload, no raw keys", async ({ page }) => {
    await page.goto("/more");
    await page.getByRole("radio", { name: "ไทย" }).click();
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("เพิ่มเติม");
    await page.reload();
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("เพิ่มเติม");
    for (const s of SCREENS) {
      await page.goto(`/${s}`);
      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(/\b(?:app|common|tabs|login|today|plan|farm|stats|more)\.[a-zA-Z]+\b/);
    }
  });

  test("sign out returns to login", async ({ page }) => {
    await page.goto("/more");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/today");
    await expect(page).toHaveURL(/\/login$/);
  });
});
