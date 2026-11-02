import { expect, test } from "@playwright/test";
import { setPrefs, signIn, uniqueEmail } from "../../helpers/auth";
import { latestSignInLink } from "../../helpers/mail";
const SHOT =
  "/private/tmp/claude-501/-Users-nichakornrojroungwattana/0c59814a-0c7c-4845-8fb9-5e646e93ab08/scratchpad/review/";
const log = (...a: unknown[]) => console.log("[R]", JSON.stringify(a));
test.setTimeout(150000);

test("double-tap send", async ({ page }) => {
  const email = uniqueEmail("dbl");
  let otpCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/auth/v1/otp")) otpCalls++;
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  const btn = page.getByRole("button", { name: "Email me a sign-in link" });
  await btn.dblclick();
  await page.waitForTimeout(3000);
  log("otp calls after dblclick:", otpCalls);
  await page
    .getByLabel("Email")
    .press("Enter")
    .catch(() => {});
  log("alert:", await page.getByRole("alert").allInnerTexts());
  // resend immediately
  await page.getByRole("button", { name: "Send a new code" }).click();
  await page.waitForTimeout(2500);
  log("after resend alert:", await page.getByRole("alert").allInnerTexts(), "otpCalls", otpCalls);
  await page.screenshot({ path: SHOT + "resend.png" });
});

test("reload mid-flow loses paste box", async ({ page }) => {
  const email = uniqueEmail("reload");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByLabel("Sign-in link or code")).toBeVisible();
  await page.reload();
  log(
    "after reload paste box visible:",
    await page
      .getByLabel("Sign-in link or code")
      .isVisible()
      .catch(() => false),
  );
  log(
    "email field value:",
    await page
      .getByLabel("Email")
      .inputValue()
      .catch(() => "n/a"),
  );
  // back button from paste step
  await page.goBack().catch(() => {});
  log("after back url:", page.url());
});

test("old link after resend", async ({ page }) => {
  const email = uniqueEmail("old");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const link1 = await latestSignInLink(email);
  await page.waitForTimeout(61000);
  await page.getByRole("button", { name: "Send a new code" }).click();
  await page.waitForTimeout(3000);
  log("resend alert:", await page.getByRole("alert").allInnerTexts());
  await page.getByLabel("Sign-in link or code").fill(link1);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(3000);
  log("old link result url:", page.url(), await page.getByRole("alert").allInnerTexts());
});

test("junk + long input", async ({ page }) => {
  await page.goto("/login");
  const long = "a".repeat(500) + "@" + "b".repeat(300) + ".com";
  await page.getByLabel("Email").fill(long);
  const ov = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  log("long email overflow:", ov);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.waitForTimeout(2500);
  log(
    "long email alert:",
    await page.getByRole("alert").allInnerTexts(),
    "paste visible",
    await page
      .getByLabel("Sign-in link or code")
      .isVisible()
      .catch(() => false),
  );
  await page.goto("/login");
  const email = uniqueEmail("junk2");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const box = page.getByLabel("Sign-in link or code");
  for (const junk of [
    "123456",
    "<script>alert(1)</script>",
    "http://evil.test/?token=abc&type=recovery",
    "x".repeat(5000),
    "javascript:alert(1)",
    " 12 34 56 ",
    "https://x/auth/v1/verify?token=zzz&type=signup",
  ]) {
    await box.fill(junk);
    const btn = page.getByRole("button", { name: "Sign in" });
    const dis = await btn.isDisabled();
    if (!dis) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    log(
      `junk ${junk.slice(0, 30)} disabled=${dis} url=${page.url()} alert=`,
      await page.getByRole("alert").allInnerTexts(),
    );
  }
  const ov2 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  log("overflow after 5000 chars:", ov2);
  await page.screenshot({ path: SHOT + "junk.png", fullPage: true });
});

test("protected routes signed out", async ({ page }) => {
  for (const p of [
    "/",
    "/today",
    "/plan",
    "/farm",
    "/stats",
    "/more",
    "/more/x",
    "/today?x=1",
    "/nonexistent",
    "/dev",
    "/share",
    "/auth/callback",
    "/offline",
  ]) {
    const res = await page.goto(p);
    log(p, "->", page.url(), res?.status());
  }
});

test("thai login + flash + touch targets", async ({ page }) => {
  await setPrefs(page, { locale: "th", theme: "dark" });
  const seen: string[] = [];
  await page.goto("/login");
  log("h1:", await page.locator("h1").innerText());
  // check the static HTML content
  const html = await (await page.request.get("/login")).text();
  log("SSR html contains EN title:", html.includes("Welcome to 24/7"), "TH:", html.includes("ยินดี"));
  const email = uniqueEmail("th");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByRole("button").first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT + "th-paste.png" });
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button,a,input,textarea")).map((e) => {
      const r = e.getBoundingClientRect();
      return `${e.tagName} ${(e.textContent || "").trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
  );
  log("controls:", small);
  seen.push("");
});

test("signed in: two tabs, sign out in one, back/forward, offline, theme", async ({ page, context }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page);
  const p2 = await context.newPage();
  await p2.goto("/more");
  log("tab2 more:", p2.url());
  await page.goto("/more");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/login/);
  await page.goBack();
  await page.waitForTimeout(1000);
  log(
    "after signout back url:",
    page.url(),
    "h1:",
    await page
      .locator("h1")
      .first()
      .innerText()
      .catch(() => "?"),
  );
  await p2.getByRole("link", { name: "Today" }).click();
  await p2.waitForTimeout(1500);
  log("tab2 after signout nav client-side:", p2.url());
  await p2.reload();
  log("tab2 after reload:", p2.url());
  await p2.close();
  // sign in again for offline
  await signIn(page);
  await page.goto("/more");
  await page.waitForTimeout(2000);
  const sw = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r ? (r.active?.state ?? "noactive") : "none";
  });
  log("sw:", sw);
  await page.reload();
  await page.waitForTimeout(1000);
  await context.setOffline(true);
  await page.getByRole("link", { name: "Plan" }).click();
  await page.waitForTimeout(1500);
  log(
    "offline client nav:",
    page.url(),
    await page
      .locator("h1")
      .first()
      .innerText()
      .catch(() => "?"),
  );
  await page.goto("/stats").catch((e) => log("offline goto err", String(e).slice(0, 80)));
  await page.waitForTimeout(1500);
  log(
    "offline hard nav body:",
    (
      await page
        .locator("body")
        .innerText()
        .catch(() => "?")
    ).slice(0, 200),
  );
  await page.screenshot({ path: SHOT + "offline.png" });
  await page
    .getByRole("radio", { name: "Dark" })
    .click()
    .catch(() => {});
  await context.setOffline(false);
  await page.goto("/more");
  await page.getByRole("radio", { name: "Dark" }).click();
  await page.getByRole("radio", { name: "ไทย" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + "more-dark-th.png" });
  const bgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[role=radio]")).map(
      (b) => `${b.textContent}:${getComputedStyle(b).backgroundColor}:${b.getAttribute("aria-checked")}`,
    ),
  );
  log("radio bgs:", bgs);
  const meta = await page.evaluate(() =>
    Array.from(document.querySelectorAll("meta[name=theme-color]")).map(
      (m) => m.getAttribute("content") + "|" + m.getAttribute("media"),
    ),
  );
  log("theme-color:", meta);
  await page.goto("/today");
  await page.screenshot({ path: SHOT + "today-dark-th.png" });
});
