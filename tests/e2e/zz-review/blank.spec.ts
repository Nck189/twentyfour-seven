import { test } from "@playwright/test";
test("blank login diag", async ({ page }) => {
  page.on("console", (m) => console.log("[C]", m.type(), m.text().slice(0, 200)));
  page.on("pageerror", (e) => console.log("[PE]", String(e).slice(0, 300)));
  page.on("requestfailed", (r) => console.log("[RF]", r.url(), r.failure()?.errorText));
  page.on("response", (r) => {
    if (r.status() >= 400) console.log("[RS]", r.status(), r.url());
  });
  await page.goto("/login");
  await page.waitForTimeout(5000);
  console.log("[R] body:", (await page.locator("body").innerText()).slice(0, 100));
  await page.goto("/login?x=1");
  await page.waitForTimeout(3000);
  console.log("[R] body2:", (await page.locator("body").innerText()).slice(0, 100));
});
