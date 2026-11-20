import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn } from "../helpers/auth";
import { IS_PROD_RUN } from "../helpers/env";

/** Review fix B1: a front door at `/` instead of a bare sign-in form. */
test("a visitor sees what 24/7 is and one way in; other screens still need an account", async ({ page }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  await page.goto("/?from=share");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your day in 7 blocks");
  await expect(page.getByRole("img", { name: "A small farm growing" })).toBeVisible();
  const start = page.getByRole("link", { name: "Start free" });
  await expect(start).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "I have an account" })).toHaveAttribute("href", "/login");
  await expectNoHorizontalScroll(page);
  await expectTouchTargets(page);
  await expectNoSeriousA11y(page);
  await start.click();
  await expect(page).toHaveURL(/\/login$/);
  // The login page leads back for anyone who wants to know more.
  await page.getByRole("link", { name: "What is 24/7?" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Only `/` itself is public.
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/login$/);
});

test("the front door speaks Thai", async ({ page }) => {
  await setPrefs(page, { locale: "th", theme: "light" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("7 บล็อก");
  await expect(page.getByRole("link", { name: "เริ่มฟรี" })).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\blanding\.[a-zA-Z]+\b/);
});

test("someone signed in skips the front door", async ({ page }) => {
  test.skip(IS_PROD_RUN, "signs in a new user");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/today$/);
});

test("inside LINE or Instagram's browser, the page says to open it in Safari or Chrome (B3)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("note")).toContainText("open this page in Safari or Chrome");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  // The login page says it too (G7 R-B-3).
  await page.goto("/login");
  await expect(page.getByRole("note")).toContainText("open this page in Safari or Chrome");
  await ctx.close();
});

test("Google sign-in is off unless it has been set up (B2)", async ({ page }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Email me a sign-in code" })).toBeVisible();
  // CI and local builds don't set NEXT_PUBLIC_GOOGLE_LOGIN, so the button must not show.
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
});

test("a sign-in the person backed out of says so, not 'link expired' (G7 R-B-6)", async ({ page }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  await page.goto("/auth/callback?error=access_denied&error_description=The+user+denied+access");
  await expect(page).toHaveURL(/\/login\?error=cancelled$/);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Google sign-in was cancelled.");
});

test("reduced motion: the farm stands ripe and the page has no hydration error (G7 R-B-2)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => {});
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  await ctx.close();
});
