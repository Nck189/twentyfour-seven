import { expect, test } from "@playwright/test";
import { uniqueEmail } from "../helpers/auth";
import { IS_PROD_RUN } from "../helpers/env";
import { latestCode } from "../helpers/mail";

test.describe("auth", () => {
  test("signed-out users are sent to /login", async ({ page }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome to 24/7" })).toBeVisible();
  });

  test("rejects an invalid email without a request", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Send magic link" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Please enter a valid email address.");
  });

  test("CJ-01 email code login lands on Today and persists after reload", async ({ page }) => {
    test.skip(IS_PROD_RUN, "needs local Mailpit");
    const email = uniqueEmail("cj01");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send magic link" }).click();
    const code = await latestCode(email);
    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.reload();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  });

  test("an expired/invalid magic link shows a friendly error", async ({ page }) => {
    await page.goto("/auth/callback?token_hash=bogus&type=magiclink");
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("expired");
  });
});
