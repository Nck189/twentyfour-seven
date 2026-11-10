import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { blockLogs, gameState, setChecklist, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { localDate } from "@/lib/time";

/**
 * M3 Today journeys. Real clock on purpose: the server marks any check-in timestamp >10 min
 * from its own clock as backfilled, so instead of faking time we place "now" inside the day
 * by moving the user's target wake.
 */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function setup(page: Page, wakeMinutesAgo: number, checklist?: { block: string; items: string[] }) {
  const email = uniqueEmail("today");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, wakeMinutesAgo);
  if (checklist) await setChecklist(id, checklist.block, checklist.items);
  await page.goto("/today");
  await expect(page.getByRole("button", { name: "See the whole day" })).toBeVisible();
  return id;
}

/** The full-day timeline is folded away by default (one thing at a time). */
async function showDay(page: Page) {
  await page.getByRole("button", { name: "See the whole day" }).click();
  await expect(page.getByRole("list", { name: "Today" })).toBeVisible();
}

test("timeline shows the 7 blocks from wake to next wake, with the current block highlighted", async ({
  page,
}) => {
  await setup(page, 150); // wake 1h + focus 1.5h → 2.5h after wake is Work
  await showDay(page);
  const rows = page.getByRole("list", { name: "Today" }).getByRole("listitem");
  await expect(rows).toHaveCount(7);
  await expect(rows.nth(0)).toContainText("Wake");
  await expect(rows.nth(6)).toContainText("Sleep");
  await expect(page.locator('[aria-current="step"]')).toContainText("Work");
  await expect(page.getByRole("region", { name: "Current block" })).toContainText("Work");
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
});

/** "Woke N min ago" must stay on today's calendar date: the I'm up card belongs to the date. */
const wokeYesterday = (minutesAgo: number) =>
  localDate(new Date(Date.now() - minutesAgo * 60_000), "Asia/Bangkok") !==
  localDate(new Date(), "Asia/Bangkok");

test("CJ-03 I'm up within the window → +1 Sunrise ticket", async ({ page }) => {
  test.skip(wokeYesterday(15), "a wake 10 min ago would land on yesterday's date");
  const id = await setup(page, 10);
  await page.getByRole("button", { name: /I'm up — out of bed/ }).click();
  await expect(page.getByText(/on time! \+1 Sunrise ticket/)).toBeVisible();
  expect((await gameState(id)).tickets).toBe(1);
  // One tap from launch: reload shows the result, not the button.
  await page.reload();
  await expect(page.getByRole("button", { name: /I'm up/ })).toHaveCount(0);
});

test("CJ-04 I'm up 20 min late → logged, no ticket", async ({ page }) => {
  test.skip(wokeYesterday(25), "a wake 20 min ago would land on yesterday's date");
  const id = await setup(page, 20);
  await page.getByRole("button", { name: /I'm up — out of bed/ }).click();
  await expect(page.getByText(/Logged — no ticket this time/)).toBeVisible();
  expect((await gameState(id)).tickets).toBe(0);
});

test("CJ-05 check-in: first-10 → 3 items → close in ≤ 5 taps and ≤ 5 s", async ({ page }) => {
  const id = await setup(page, 150, { block: "work", items: ["Inbox zero", "YOP draft", "Email advisor"] });
  const card = page.getByRole("region", { name: "Current block" });
  const t0 = Date.now();
  let taps = 0;
  const tap = async (name: string | RegExp) => {
    await card.getByRole("checkbox", { name }).click();
    taps++;
  };
  await tap(/Map the day/);
  await tap("Inbox zero");
  await tap("YOP draft");
  await tap("Email advisor");
  await card.getByRole("button", { name: "Finish block" }).click();
  taps++;
  await expect(card.getByText(/Closed \d\d:\d\d/)).toBeVisible();
  const elapsed = Date.now() - t0;
  expect(taps).toBeLessThanOrEqual(5);
  expect(elapsed).toBeLessThan(5000);

  // Wait for every write, the close included (the items can land before it).
  await expect
    .poll(async () => {
      const l = (await blockLogs(id)).find((x) => x.block === "work");
      return l && { ...l, closed: !!l.closed_at, first10: !!l.first10_at, started: !!l.started_at };
    })
    .toMatchObject({
      backfilled: false,
      items_done: ["work-0", "work-1", "work-2"],
      items_planned: 3,
      closed: true,
      first10: true,
      started: true,
    });
  await showDay(page);
  await expect(page.locator('[aria-current="step"]')).toContainText("Done");
  // Optional mood/energy after closing (not part of the 5-tap budget).
  await card.getByRole("radio", { name: "Mood 4" }).click();
  await card.getByRole("radio", { name: "Energy 2" }).click();
  await expect
    .poll(async () => (await blockLogs(id)).find((l) => l.block === "work"))
    .toMatchObject({ mood: 4, energy: 2 });
});

test("CJ-06 backfilling a past block: counts, labeled backfilled", async ({ page }) => {
  const id = await setup(page, 150);
  await showDay(page);
  await page.getByRole("button", { name: "Open Wake" }).click();
  const sheet = page.getByRole("dialog", { name: "Wake" });
  await expect(sheet.getByRole("note")).toContainText("backfilled");
  await sheet.getByRole("checkbox", { name: /Leave the bedroom/ }).click();
  await sheet.getByRole("button", { name: "Finish block" }).click();
  await expect(sheet.getByText(/Closed \d\d:\d\d/)).toBeVisible();
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Wake" })).toContainText("Backfilled");
  await expect.poll(async () => (await blockLogs(id)).find((l) => l.block === "wake")?.backfilled).toBe(true);
  expect((await gameState(id)).tickets).toBe(0);
});

test("location is asked when Work is finished; vacation mode lives in the menu", async ({ page }) => {
  const id = await setup(page, 150);
  const card = page.getByRole("region", { name: "Current block" });
  await expect(card.getByRole("radiogroup", { name: "Where were you?" })).toHaveCount(0);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await card.getByRole("button", { name: "Finish block" }).click();
  await card.getByRole("radio", { name: "Out" }).click();
  await expect.poll(async () => (await blockLogs(id)).find((l) => l.block === "work")?.location).toBe("out");
  await page.getByRole("button", { name: "More for today" }).click();
  const menu = page.getByRole("dialog", { name: "More for today" });
  await menu.getByRole("radiogroup", { name: "Day mode" }).getByRole("radio", { name: "Vacation" }).click();
  await menu.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText("Vacation mode")).toBeVisible();
});

test("one thing at a time: the current block, a Next line; the rest is folded away", async ({ page }) => {
  await setup(page, 150, { block: "work", items: ["Alpha"] });
  const card = page.getByRole("region", { name: "Current block" });
  await expect(card).toContainText("Work");
  // Nothing to finish before the block has started.
  await expect(card.getByRole("button", { name: "Finish block" })).toHaveCount(0);
  await expect(page.getByText(/^Next: Gradation · \d\d:\d\d$/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Today" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "20 min" })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Day mode" })).toHaveCount(0);
  await card.getByRole("checkbox", { name: "Alpha", exact: true }).click();
  await expect(card.getByRole("button", { name: "Finish block" })).toBeVisible();
  await page.getByRole("button", { name: "More for today" }).click();
  await expect(
    page.getByRole("dialog", { name: "More for today" }).getByRole("button", { name: "20 min" }),
  ).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
});

test("power nap timer starts and can be stopped", async ({ page }) => {
  await setup(page, 150);
  await page.getByRole("button", { name: "More for today" }).click();
  await page.getByRole("button", { name: "20 min" }).click();
  await expect(page.getByText(/Nap ends at \d\d:\d\d/)).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "25 min" })).toBeVisible();
});

test("CJ-15 two devices: a tick on one shows up on the other", async ({ browser }) => {
  const email = uniqueEmail("cj15");
  const a = await (await browser.newContext()).newPage();
  await setPrefs(a, { locale: "en", theme: "light" });
  await signIn(a, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 150);
  await setChecklist(id, "work", ["One", "Two"]);
  const b = await (await browser.newContext()).newPage();
  await setPrefs(b, { locale: "en", theme: "light" });
  await signIn(b, email);
  await a.goto("/today");
  await b.goto("/today");
  await a.getByRole("region", { name: "Current block" }).getByRole("checkbox", { name: "One" }).click();
  await b.getByRole("region", { name: "Current block" }).getByRole("checkbox", { name: "Two" }).click();
  // Diagnostics: the tap must stick on B with no save error.
  await expect(
    b.getByRole("region", { name: "Current block" }).getByRole("checkbox", { name: "Two" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(b.getByRole("main").getByRole("alert")).toHaveCount(0);
  // Both items survive (atomic toggles) and both devices converge.
  await expect
    .poll(async () => ((await blockLogs(id)).find((l) => l.block === "work")?.items_done as string[])?.sort())
    .toEqual(["work-0", "work-1"]);
  await expect(
    a.getByRole("region", { name: "Current block" }).getByRole("checkbox", { name: "Two" }),
  ).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000,
  });
});

test("CJ-16 network failure mid-action rolls back with a friendly message; retry works", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "WebKit can't intercept requests to the local API");
  const id = await setup(page, 150, { block: "work", items: ["Alpha"] });
  await page.route("**/rest/v1/rpc/set_block_item**", (r) => r.abort("internetdisconnected"));
  const item = page.getByRole("region", { name: "Current block" }).getByRole("checkbox", { name: "Alpha" });
  await item.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Nothing was lost");
  await expect(item).toHaveAttribute("aria-checked", "false");
  await page.unroute("**/rest/v1/rpc/set_block_item**");
  await page.getByRole("main").getByRole("alert").getByRole("button", { name: "Try again" }).click();
  await expect(item).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => (await blockLogs(id)).find((l) => l.block === "work")?.items_done)
    .toEqual(["work-0"]);
});
