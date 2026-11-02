import { IS_PROD_RUN } from "../helpers/env";
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

test("keep-alive endpoint: 401 without the cron secret, 200 + DB round-trip with it", async ({ request }) => {
  expect((await request.get("/api/keepalive")).status()).toBe(401);
  expect((await request.get("/api/keepalive", { headers: { authorization: "Bearer wrong" } })).status()).toBe(
    401,
  );
  const secret = process.env.CRON_SECRET;
  test.skip(!secret || IS_PROD_RUN, "secret only available locally");
  const ok = await request.get("/api/keepalive", { headers: { authorization: `Bearer ${secret}` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ ok: true, status: 200 });
});
