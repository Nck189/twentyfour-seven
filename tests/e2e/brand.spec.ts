import { expect, test } from "@playwright/test";

/** Review fix A3: a pasted link shows a picture (LINE, IG, iMessage read these tags without a session). */
test("the login page carries a link-preview picture, reachable signed-out", async ({ page, request }) => {
  await page.goto("/login");
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toMatch(/\/opengraph-image\.png/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const res = await request.get("/opengraph-image.png");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  const buf = await res.body();
  // PNG header: width and height at bytes 16–23.
  expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1200, 630]);
});

test("the app icon files exist for the browser, the manifest and iOS", async ({ request }) => {
  for (const path of [
    "/icon.svg",
    "/apple-icon.png",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
  ])
    expect((await request.get(path)).status(), path).toBe(200);
});
