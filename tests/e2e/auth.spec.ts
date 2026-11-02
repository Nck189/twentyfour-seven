import { expect, test } from "@playwright/test";
import { uniqueEmail } from "../helpers/auth";
import { IS_PROD_RUN } from "../helpers/env";
import { latestSignInCode, latestSignInText } from "../helpers/mail";

test.describe("auth", () => {
  test("signed-out users are sent to /login", async ({ page }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome to 24/7" })).toBeVisible();
  });

  test("rejects an invalid email without a request", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Please enter a valid email address.");
  });

  test("CJ-01 email login with the 6-digit code lands on Today and persists after reload", async ({
    page,
  }) => {
    test.skip(IS_PROD_RUN, "needs local Mailpit");
    const email = uniqueEmail("cj01");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    // The email carries the code only: no link for a mail app's preview to use up.
    const text = await latestSignInText(email);
    expect(text).not.toMatch(/https?:\/\//);
    const code = await latestSignInCode(email);
    expect(code).toMatch(/^\d{6}$/);
    const field = page.getByLabel("Sign-in code");
    await expect(field).toHaveAttribute("autocomplete", "one-time-code");
    await expect(field).toHaveAttribute("inputmode", "numeric");
    await field.fill(code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.reload();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  });

  test("a pasted junk value shows a friendly error", async ({ page }) => {
    test.skip(IS_PROD_RUN, "needs local Mailpit");
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("junk"));
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await page.getByLabel("Sign-in code").fill("https://example.com/nothing-here");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("didn't work");
  });

  test("an expired/invalid magic link shows a friendly error", async ({ page }) => {
    await page.goto("/auth/callback?token_hash=bogus&type=magiclink");
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("expired");
  });
});

test("pasted email with spaces / zero-width characters still sends the code", async ({ page }) => {
  test.skip(IS_PROD_RUN, "needs local Mailpit");
  await page.goto("/login");
  const email = uniqueEmail("zw");
  await page.getByLabel("Email").fill(`  ​${email}  `);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});
