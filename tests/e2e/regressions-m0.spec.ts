import { expect, test } from "@playwright/test";
import { expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { IS_PROD_RUN } from "../helpers/env";
import { latestSignInCode } from "../helpers/mail";

/** Regression tests for the M0 independent review (docs/qa/M0-report.md). */
test.describe("M0 review regressions", () => {
  test.skip(IS_PROD_RUN, "uses local email");

  test("F3: the paste step survives a reload (iOS evicting the PWA while in Mail)", async ({ page }) => {
    await setPrefs(page, { locale: "en", theme: "light" });
    const email = uniqueEmail("f3");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("F3b: after that reload, the code from the email still signs in", async ({ page }) => {
    await setPrefs(page, { locale: "en", theme: "light" });
    const email = uniqueEmail("f3b");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
    await page.reload(); // iOS reloads the home-screen app while you're in Mail
    await page.getByLabel("Sign-in code").fill(await latestSignInCode(email));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/today$/);
  });

  test("F5: resend shows a countdown, then a 'new code sent' confirmation", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "WebKit can't intercept requests to the local auth server; covered on Chromium",
    );
    await page.clock.install();
    await setPrefs(page, { locale: "en", theme: "light" });
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("f5"));
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByRole("button", { name: /Send a new code \(\d+s\)/ })).toBeDisabled();
    await page.clock.fastForward(61_000);
    // The fake clock doesn't move the auth server's own rate limit, so stub the resend.
    await page.route("**/auth/v1/otp**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );
    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByRole("status")).toHaveText("New code sent. Check your email.");
  });

  test("F5: a rate-limited resend explains that the earlier code still works", async ({ page }) => {
    await page.clock.install();
    await setPrefs(page, { locale: "en", theme: "light" });
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("f5b"));
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
    await page.clock.fastForward(61_000);
    await page.route("**/auth/v1/otp**", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ code: 429, error_code: "over_email_send_rate_limit", msg: "rate limit" }),
      }),
    );
    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("earlier code still works");
  });

  test("F6/F4: wording matches a code-only email (no link to tap or copy)", async ({ page }) => {
    await setPrefs(page, { locale: "en", theme: "light" });
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("f6"));
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByText(/6-digit code/)).toBeVisible();
    await expect(page.getByText(/link/i)).toHaveCount(0);
    await expectTouchTargets(page);
  });

  test("F13: language can be switched on the login screen", async ({ page }) => {
    await setPrefs(page, { locale: "en", theme: "light" });
    await page.goto("/login");
    await page.getByRole("radio", { name: "ไทย" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ยินดีต้อนรับสู่ 24/7");
    await expectTouchTargets(page);
  });

  test("F10: unknown pages show a branded, localized 404 with a way back", async ({ page }) => {
    await setPrefs(page, { locale: "th", theme: "light" });
    await signIn(page);
    await page.goto("/nonexistent-page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ไม่พบหน้านี้");
    await page.getByRole("link", { name: "กลับไปหน้าวันนี้" }).click();
    await expect(page).toHaveURL(/\/today$/);
  });

  test("F2: the offline page is self-contained, localized and has no black", async ({ page, request }) => {
    const res = await request.get("/offline.html");
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+stylesheet/); // no external chunks needed
    expect(html).not.toMatch(/#000\b|#000000|black/i);
    await page.addInitScript(() =>
      localStorage.setItem(
        "247-prefs",
        JSON.stringify({ state: { locale: "th", theme: "light" }, version: 0 }),
      ),
    );
    await page.goto("/offline.html");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ตอนนี้ออฟไลน์อยู่");
    await expect(page.getByRole("button", { name: "ลองอีกครั้ง" })).toBeVisible();
  });

  test("F9: the service worker cache is versioned per build", async ({ request }) => {
    const sw = await (await request.get("/sw.js")).text();
    expect(sw).toMatch(/new URL\(self\.location\)\.searchParams\.get\("v"\)/);
    expect(sw).toContain("/offline.html");
  });

  test("F11: iPad Farm tab doesn't show the farm twice", async ({ page }, info) => {
    test.skip(
      !["ipad-landscape", "mac", "chrome-desktop", "ipad-portrait"].includes(info.project.name),
      "split view only",
    );
    await setPrefs(page, { locale: "en", theme: "light" });
    await signIn(page);
    await page.goto("/farm");
    await expect(page.getByRole("heading", { name: "Farm" })).toHaveCount(1);
  });

  test("F8: no internal milestone codes in user-facing text", async ({ page }) => {
    await setPrefs(page, { locale: "en", theme: "light" });
    await signIn(page);
    for (const s of ["today", "plan", "farm", "stats"]) {
      await page.goto(`/${s}`);
      await expect(page.locator("body")).not.toContainText(/\bM\d{1,2}\b/);
    }
  });
});
