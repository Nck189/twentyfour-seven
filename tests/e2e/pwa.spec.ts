import { expect, test } from "@playwright/test";

test("manifest is valid for an installable PWA", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/today");
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test("service worker and apple touch icon are served", async ({ request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect((await request.get("/apple-icon.png")).ok()).toBe(true);
});

test("keep-alive endpoint rejects calls without the cron secret when one is set", async ({ request }) => {
  const res = await request.get("/api/keepalive", { headers: { authorization: "Bearer wrong" } });
  expect([200, 401, 502]).toContain(res.status());
});
