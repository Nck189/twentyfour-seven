import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { IS_PROD_RUN } from "../helpers/env";

test.describe("data", () => {
  test("CJ-17 export downloads JSON with every table and a CSV zip", async ({ page }) => {
    await setPrefs(page, { locale: "en", theme: "light" });
    await signIn(page);
    await page.goto("/more");

    const [json] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export JSON" }).click(),
    ]);
    expect(json.suggestedFilename()).toMatch(/^24-7-export-\d{4}-\d{2}-\d{2}\.json$/);
    const bundle = JSON.parse(readFileSync((await json.path())!, "utf8"));
    expect(bundle.app).toBe("24/7");
    expect(Object.keys(bundle.tables)).toHaveLength(16);
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
