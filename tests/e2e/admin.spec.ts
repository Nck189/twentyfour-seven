import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { IS_PROD_RUN } from "../helpers/env";

/** G3 retention dashboard: only ADMIN_EMAILS (server env) can open it; everyone else gets a 404. */
test.skip(IS_PROD_RUN, "uses a test admin account");

test("G3 the admin sees sign-up cohorts; anyone else gets not-found", async ({ page, browser }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, `admin-e2e-${test.info().project.name}@test.local`);
  await page.goto("/admin/retention");
  await expect(page.getByRole("heading", { level: 1, name: "Retention" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Retention" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Day 7" })).toBeVisible();
  await expectNoSeriousA11y(page);

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await setPrefs(other, { locale: "en", theme: "light" });
  await signIn(other, uniqueEmail("not-admin"));
  await other.goto("/admin/retention");
  await expect(other.getByText(/not found/i).first()).toBeVisible();
  await expect(other.getByRole("table")).toHaveCount(0);
  await ctx.close();
});
