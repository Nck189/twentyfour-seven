import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { addWakeEvent, blockLogs, setChecklist, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, localDate } from "@/lib/time";

/** Regressions for the M1–M3 independent review (docs/qa/M3-report.md). */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function user(page: Page) {
  const email = uniqueEmail("rm3");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  return userIdFor(email);
}
const yesterday = () => addDays(localDate(new Date(), "Asia/Bangkok"), -1);
/** These scenarios need "target = now + N min" to stay on today's calendar date. */
const crossesMidnight = (minutesAhead: number) =>
  localDate(new Date(Date.now() + minutesAhead * 60_000), "Asia/Bangkok") !==
  localDate(new Date(), "Asia/Bangkok");

test("M3-F2a early riser: 1 h before target the I'm up button shows (not yesterday's result)", async ({
  page,
}) => {
  test.skip(crossesMidnight(60), "target would land on tomorrow's date");
  const id = await user(page);
  await addWakeEvent(id, yesterday(), true);
  await setWakeMinutesAgo(id, -60); // target is 60 min from now
  await page.goto("/today");
  await expect(page.getByRole("button", { name: /I'm up — out of bed/ })).toBeVisible();
});

test("M3-F2b app left open overnight: the button appears when the new wake window opens, no reload", async ({
  page,
}) => {
  test.skip(crossesMidnight(240), "target would land on tomorrow's date");
  const id = await user(page);
  await addWakeEvent(id, yesterday(), true);
  await setWakeMinutesAgo(id, -240); // 4 h before target: too early, shows yesterday's result
  await page.clock.install();
  await page.goto("/today");
  await expect(page.getByText(/on time! \+1 Sunrise ticket/)).toBeVisible();
  await expect(page.getByRole("button", { name: /I'm up/ })).toHaveCount(0);
  await page.clock.fastForward(75 * 60_000); // now 2 h 45 min before target
  await expect(page.getByRole("button", { name: /I'm up — out of bed/ })).toBeVisible({ timeout: 10_000 });
});

test("M3-F3 two failed saves offline: Try again saves both (nothing silently lost)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "WebKit can't intercept requests to the local API");
  const id = await user(page);
  await setWakeMinutesAgo(id, 150);
  await setChecklist(id, "work", ["A", "B"]);
  await page.goto("/today");
  const card = page.getByRole("region", { name: "Current block" });
  await page.route("**/rest/v1/rpc/set_block_item**", (r) => r.abort("internetdisconnected"));
  await card.getByRole("checkbox", { name: "A", exact: true }).click();
  await card.getByRole("checkbox", { name: "B", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Nothing was lost");
  await page.unroute("**/rest/v1/rpc/set_block_item**");
  await page.getByRole("main").getByRole("alert").getByRole("button", { name: "Try again" }).click();
  await expect(card.getByRole("checkbox", { name: "A", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(card.getByRole("checkbox", { name: "B", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect
    .poll(async () => ((await blockLogs(id)).find((l) => l.block === "work")?.items_done as string[])?.sort())
    .toEqual(["work-0", "work-1"]);
});

test("M3-F5 nap timer survives a reload", async ({ page }) => {
  const id = await user(page);
  await setWakeMinutesAgo(id, 150);
  await page.goto("/today");
  await page.getByRole("button", { name: "20 min" }).click();
  await expect(page.getByText(/Nap ends at \d\d:\d\d/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Nap ends at \d\d:\d\d/)).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
});

test("M3-F6 a backfilled start never says 'On time'", async ({ page }) => {
  const id = await user(page);
  await setWakeMinutesAgo(id, 150);
  await page.goto("/today");
  await page.getByRole("button", { name: "Open Wake" }).click();
  const sheet = page.getByRole("dialog", { name: "Wake" });
  await sheet.getByRole("button", { name: "Start", exact: true }).click();
  await expect(sheet.getByText(/Started \d\d:\d\d/)).toBeVisible();
  await expect(sheet.getByText("On time")).toHaveCount(0);
  await expect(sheet.getByText("Backfilled", { exact: true })).toBeVisible();
});

test("M3-F7 a very long checklist word wraps (no horizontal scroll)", async ({ page }) => {
  const id = await user(page);
  await setWakeMinutesAgo(id, 150);
  await setChecklist(id, "work", [
    "Supercalifragilisticexpialidocious-and-a-very-long-identifier-without-spaces",
  ]);
  await page.goto("/today");
  await expect(page.getByRole("region", { name: "Current block" }).getByRole("checkbox")).toHaveCount(2);
  await expectNoHorizontalScroll(page);
});

/** Simulate the app going to the background / coming back (iOS app switcher). */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (h ? "hidden" : "visible"),
    });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}
const isLogsRefetch = (url: string, method: string) =>
  method === "GET" && url.includes("/rest/v1/block_logs");

test("CJ-15 flake: a quick app switch doesn't refetch, and a tap right after it is saved", async ({
  page,
}) => {
  const id = await user(page);
  await setWakeMinutesAgo(id, 150);
  await setChecklist(id, "work", ["A"]);
  await page.goto("/today");
  const item = page
    .getByRole("region", { name: "Current block" })
    .getByRole("checkbox", { name: "A", exact: true });
  await expect(item).toBeVisible();
  let refetches = 0;
  page.on("request", (r) => {
    if (isLogsRefetch(r.url(), r.method())) refetches++;
  });
  await setHidden(page, true);
  await setHidden(page, false);
  const saved = page.waitForRequest((r) => r.url().includes("/rest/v1/rpc/set_block_item"));
  await item.click();
  await saved;
  await expect(item).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => (await blockLogs(id)).find((l) => l.block === "work")?.items_done)
    .toEqual(["work-0"]);
  expect(refetches).toBe(0);
});

test("foreground after a long hide (≥ 60 s) refreshes Today", async ({ page }) => {
  const id = await user(page);
  await setWakeMinutesAgo(id, 150);
  await page.clock.install();
  await page.goto("/today");
  await expect(page.getByRole("region", { name: "Current block" })).toBeVisible();
  await setHidden(page, true);
  await page.clock.fastForward(61_000);
  const refetch = page.waitForRequest((r) => isLogsRefetch(r.url(), r.method()));
  await setHidden(page, false);
  await refetch;
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
