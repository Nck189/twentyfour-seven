import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y } from "../helpers/a11y";
import { setPrefs, settle, signIn, uniqueEmail } from "../helpers/auth";
import { rest, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { EXPORT_TABLES } from "@/lib/export/tables";

test.describe("data", () => {
  test("CJ-17 export downloads JSON with every table and a CSV zip", async ({ page }) => {
    await setPrefs(page, { locale: "en", theme: "light" });
    await signIn(page);
    await page.goto("/more");
    // A tap before More is interactive does nothing on a slow WebKit phone (CI 2026-11-20): wait.
    await settle(page);

    const [json] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export JSON" }).click(),
    ]);
    expect(json.suggestedFilename()).toMatch(/^24-7-export-\d{4}-\d{2}-\d{2}\.json$/);
    const bundle = JSON.parse(readFileSync((await json.path())!, "utf8"));
    expect(bundle.app).toBe("24/7");
    expect(Object.keys(bundle.tables).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(bundle.tables.templates).toHaveLength(6);
    expect(bundle.tables.settings[0].weekly_exercise_goal).toBe(3);

    const [zip] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV (zip)" }).click(),
    ]);
    expect(zip.suggestedFilename()).toMatch(/\.zip$/);
    const bytes = readFileSync((await zip.path())!);
    expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
    await expect(page.getByText("Downloaded.")).toBeVisible();
  });

  test("regression: Thai picked before first login stays Thai after login", async ({ page }) => {
    test.skip(IS_PROD_RUN, "creates a dedicated user");
    await setPrefs(page, { locale: "th", theme: "light" });
    await signIn(page);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("วันนี้");
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("วันนี้");
  });

  test("CJ-14 language follows the account to a second device", async ({ browser }) => {
    test.skip(IS_PROD_RUN, "creates a dedicated user");
    const email = uniqueEmail("cj14");
    const phone = await browser.newContext();
    const p1 = await phone.newPage();
    await setPrefs(p1, { locale: "en", theme: "light" });
    await signIn(p1, email);
    await p1.goto("/more");
    await settle(p1); // More answers taps only once it is interactive (slow WebKit)
    await p1.getByRole("radio", { name: "ไทย" }).click();
    await expect(p1.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("เพิ่มเติม");
    await p1.waitForTimeout(500); // let the profile write land

    const mac = await browser.newContext();
    const p2 = await mac.newPage();
    await setPrefs(p2, { locale: "en", theme: "light" });
    await signIn(p2, email);
    await expect(p2.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("วันนี้");
    await phone.close();
    await mac.close();
  });
});

test("regression: language change survives an immediate reload while the profile save is still in flight", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "WebKit can't intercept requests to the local API");
  test.skip(IS_PROD_RUN, "uses request interception");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page);
  await page.waitForTimeout(800); // first-login sync done
  await page.goto("/more");
  await settle(page); // More answers taps only once it is interactive (slow WebKit)
  // Hold every profile write for 3 s so the reload happens first.
  await page.route("**/rest/v1/profiles**", async (route) => {
    if (route.request().method() === "PATCH") await new Promise((r) => setTimeout(r, 3000));
    await route.continue().catch(() => {});
  });
  await page.getByRole("radio", { name: "ไทย" }).click();
  await page.goto("/today");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("วันนี้");
  await page.waitForTimeout(1500);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("วันนี้");
});

test("G15 delete my account: two steps, then signed out and the data is gone", async ({ page }) => {
  test.skip(IS_PROD_RUN, "deletes a user");
  const email = uniqueEmail("delete-me");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await page.goto("/more");
  // A tap before the page is interactive does nothing (CI WebKit, 2026-11-16): wait for it.
  await settle(page);
  await page.getByRole("button", { name: "Delete my account" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete your account?" });
  await expect(confirm).toBeVisible();
  await expectNoSeriousA11y(page);
  await confirm.getByRole("button", { name: "Keep my account" }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await confirm.getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await rest(`profiles?user_id=eq.${id}&select=user_id`)).toEqual([]);
});
