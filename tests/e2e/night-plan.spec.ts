import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import {
  blockLogs,
  dayPlans,
  gameState,
  rest,
  setAllTemplates,
  setWakeMinutesAgo,
  userIdFor,
} from "../helpers/db";
import { localDate } from "@/lib/time";
import { IS_PROD_RUN } from "../helpers/env";

test.skip(IS_PROD_RUN, "creates dedicated users");

/** Wake 1h + Focus 1.5h + Work 9h + Gradation 1h + Free 2.5h = 15h → 15h10m after wake is Down Time. */
const DOWN_TIME_MINUTES_AFTER_WAKE = 910;

async function newUserOn(page: Page) {
  const email = uniqueEmail("m4");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  return userIdFor(email);
}

test("CJ-07 night ritual end to end: open blocks closed with reasons, tomorrow planned, Night ticket +1, under 2 min", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = await newUserOn(page);
  await setWakeMinutesAgo(id, DOWN_TIME_MINUTES_AFTER_WAKE);
  const t0 = Date.now();
  await page.goto("/today");

  // Auto-offered at Down Time.
  const sheet = page.getByRole("dialog", { name: "Night ritual" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Step 1 of 4")).toBeVisible();
  await sheet.getByRole("button", { name: "Start 10-min timer" }).click();
  await expect(sheet.getByText(/\d+:\d\d left/)).toBeVisible();
  await sheet.getByRole("button", { name: "Skip timer" }).click();

  // Close today: 5 untouched blocks, tag each.
  await expect(sheet.getByText("Step 2 of 4")).toBeVisible();
  for (const block of ["Wake", "Focus", "Work", "Gradation", "Free"]) {
    await sheet
      .getByRole("group", { name: `Reason for ${block}` })
      .getByRole("button", { name: block === "Work" ? "Interruption" : "Phone" })
      .click();
  }
  await expect(sheet.getByText("Every block is closed. Nice.")).toBeVisible();
  await sheet.getByRole("button", { name: "Next" }).click();

  // Plan tomorrow: push bedtime 15 min and add a checklist item to Work.
  await expect(sheet.getByText("Step 3 of 4")).toBeVisible();
  await sheet.getByRole("button", { name: "15 min later" }).click();
  await expect(sheet.getByText("15 min later than target")).toBeVisible();
  await sheet.getByRole("button", { name: "Work", exact: true }).click();
  await sheet.getByRole("textbox", { name: "New checklist item" }).fill("YOP chapter 2");
  await sheet.getByRole("button", { name: "Add item" }).click();
  await expect(sheet.getByText("YOP chapter 2")).toBeVisible();
  await sheet.getByRole("button", { name: "Next" }).click();

  // Goodnight.
  await sheet.getByRole("checkbox", { name: "Alarm set + phone away" }).click();
  await sheet.getByRole("button", { name: "Goodnight" }).click();
  await expect(sheet.getByText("+1 Night ticket. Sleep well.")).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(120_000);

  expect((await gameState(id)).tickets).toBe(1);
  const logs = await blockLogs(id);
  expect(logs.filter((l) => l.miss_reason)).toHaveLength(5);
  expect(logs.find((l) => l.block === "work")!.miss_reason).toBe("interruption");
  const plans = await dayPlans(id);
  const tomorrow = plans.find((p) => p.bedtime_override);
  expect(tomorrow).toBeTruthy();
  expect(JSON.stringify(tomorrow!.overrides)).toContain("YOP chapter 2");

  await sheet.getByRole("button", { name: "Night ritual done" }).click();
  await page.reload();
  await expect(page.getByText("Night ritual done")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Night ritual" })).toHaveCount(0);
});

test("CJ-08 bedtime +90 on a free day: tomorrow re-flows +90, Free shrinks, the next night snaps back", async ({
  page,
}) => {
  const id = await newUserOn(page);
  await setAllTemplates(id, "10:00");
  await page.goto("/plan");
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Plan Tomorrow" }).click();
  const sheet = page.getByRole("dialog");
  const preview = sheet.getByRole("list", { name: "Preview" });
  await expect(preview).toContainText("10:00");
  for (let i = 0; i < 6; i++) await sheet.getByRole("button", { name: "15 min later" }).click();
  await expect(sheet.getByText("90 min later than target")).toBeVisible();
  await expect(sheet.locator("output")).toHaveText("04:00");
  // Wake moves to 11:30 instantly; Free shrinks from 2.5h to 1h.
  await expect(preview.getByRole("listitem").nth(2)).toContainText("11:30");
  await expect(preview.getByRole("listitem").nth(6)).toContainText("1h");
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  const tomorrowCard = page.getByRole("region", { name: "Tomorrow" });
  await expect(tomorrowCard).toContainText("Bed 04:00");
  await expect(tomorrowCard).toContainText("Wake 11:30");
  // The day after tomorrow is untouched (snap-back).
  await page.getByRole("list", { name: "Next 7 days" }).getByRole("button").nth(2).click();
  const dayAfter = page.getByRole("region").filter({ hasText: /Bed \d\d:\d\d/ });
  await expect(dayAfter).toContainText("Bed 02:30");
  await expect(dayAfter).toContainText("Wake 10:00");
  await expect.poll(async () => (await dayPlans(id)).filter((p) => p.bedtime_override).length).toBe(1);
});

test("CJ-09 bedtime +2h before a class day: class unmoved, 'only Xh sleep' warning", async ({ page }) => {
  const id = await newUserOn(page);
  await setAllTemplates(id, "07:30", [
    { id: "class", key: "class", title: null, start: "09:00", end: "16:00" },
  ]);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Plan Tomorrow" }).click();
  const sheet = page.getByRole("dialog");
  for (let i = 0; i < 8; i++) await sheet.getByRole("button", { name: "15 min later" }).click();
  await expect(sheet.locator("output")).toHaveText("02:00");
  await expect(sheet.getByRole("alert").filter({ hasText: "Only 6.5h sleep planned" })).toBeVisible();
  const preview = sheet.getByRole("list", { name: "Preview" });
  await expect(preview.getByRole("listitem").nth(4)).toContainText("09:00"); // Work starts at class
});

test("CJ-10 out late tonight: planned, Down starts at return, no short-sleep warning", async ({ page }) => {
  const id = await newUserOn(page);
  await setAllTemplates(id, "10:00");
  await page.goto("/plan");
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Plan Tomorrow" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Home at").fill("03:30");
  const preview = sheet.getByRole("list", { name: "Preview" });
  await expect(preview.getByRole("listitem").nth(0)).toContainText("03:30");
  await expect(sheet.locator("output")).toHaveText("04:00");
  await expect(sheet.getByRole("alert")).toHaveCount(0);
  await expect.poll(async () => (await dayPlans(id)).find((p) => p.late_night)?.late_night).toBeTruthy();
});

test("Plan week view: 7 days, Thu toggle, overrides don't touch templates; a11y + targets", async ({
  page,
}) => {
  const id = await newUserOn(page);
  await page.goto("/plan");
  await expect(page.getByRole("list").first().getByRole("listitem")).toHaveCount(7);
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Plan Tomorrow" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Home weekend/ }).click();
  await expect(sheet.getByRole("radio", { name: /Home weekend/ })).toHaveAttribute("aria-checked", "true");
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("region", { name: "Tomorrow" })).toContainText("Home weekend");
  await expect(page.getByRole("region", { name: "Tomorrow" })).toContainText("Edited");
  // Templates themselves are unchanged.
  const tpls = (await (
    await import("../helpers/db")
  ).rest(`templates?user_id=eq.${id}&select=key,target_wake`)) as {
    key: string;
    target_wake: string;
  }[];
  expect(tpls.find((t) => t.key === "class_wed")!.target_wake).toBe("07:30:00");
});

test("Night ritual: one tap tags every open block with the same reason", async ({ page }) => {
  const id = await newUserOn(page);
  await setWakeMinutesAgo(id, DOWN_TIME_MINUTES_AFTER_WAKE);
  await page.goto("/today");
  const sheet = page.getByRole("dialog", { name: "Night ritual" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Next" }).click();
  await sheet
    .getByRole("region", { name: "Same reason for all" })
    .getByRole("button", { name: "Sleepy" })
    .click();
  await expect(sheet.getByText("Every block is closed. Nice.")).toBeVisible();
  await expect
    .poll(async () => (await blockLogs(id)).filter((l) => l.miss_reason === "sleepy").length)
    .toBe(5);
  await expectTouchTargets(page);
});

test("R-M4-3: a block that was started closes as done (no miss reason); 'same for all' skips it", async ({
  page,
}) => {
  const id = await newUserOn(page);
  await setWakeMinutesAgo(id, DOWN_TIME_MINUTES_AFTER_WAKE);
  // Focus was started this morning and never finished.
  const day = localDate(new Date(Date.now() - DOWN_TIME_MINUTES_AFTER_WAKE * 60_000), "Asia/Bangkok");
  await rest("block_logs", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      date: day,
      block: "focus",
      started_at: new Date(Date.now() - (DOWN_TIME_MINUTES_AFTER_WAKE - 60) * 60_000).toISOString(),
    }),
  });
  await page.goto("/today");
  const sheet = page.getByRole("dialog", { name: "Night ritual" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Next" }).click();
  await sheet.getByRole("button", { name: "Mark done Focus" }).click();
  await sheet
    .getByRole("region", { name: "Same reason for all" })
    .getByRole("button", { name: "Sleepy" })
    .click();
  await expect(sheet.getByText("Every block is closed. Nice.")).toBeVisible();
  await expect
    .poll(async () => (await blockLogs(id)).find((l) => l.block === "focus"))
    .toMatchObject({ miss_reason: null });
  const logs = await blockLogs(id);
  expect(logs.find((l) => l.block === "focus")?.closed_at).toBeTruthy();
  expect(logs.filter((l) => l.miss_reason === "sleepy")).toHaveLength(4);
});

test("R-M4-5: Goodnight waits until tomorrow's plan is saved (offline edit isn't lost)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "WebKit can't intercept requests to the local API");
  const id = await newUserOn(page);
  await setWakeMinutesAgo(id, DOWN_TIME_MINUTES_AFTER_WAKE);
  await page.goto("/today");
  const sheet = page.getByRole("dialog", { name: "Night ritual" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Next" }).click();
  await sheet
    .getByRole("region", { name: "Same reason for all" })
    .getByRole("button", { name: "Sleepy" })
    .click();
  await sheet.getByRole("button", { name: "Next" }).click();
  // Day-plan saves go through the merge RPC (or the plain upsert before that migration).
  const offline = (r: import("@playwright/test").Route) =>
    r.request().method() === "POST" ? r.abort("internetdisconnected") : r.continue();
  await page.route("**/rest/v1/rpc/patch_day_plan**", offline);
  await page.route("**/rest/v1/day_plans**", offline);
  await sheet.getByRole("button", { name: "15 min later" }).click();
  await sheet.getByRole("button", { name: "Next" }).click();
  await sheet.getByRole("checkbox", { name: "Alarm set + phone away" }).click();
  await sheet.getByRole("button", { name: "Goodnight" }).click();
  await expect(sheet.getByRole("alert")).toContainText("Tomorrow's plan isn't saved yet");
  expect((await gameState(id)).tickets).toBe(0);

  await page.unroute("**/rest/v1/rpc/patch_day_plan**");
  await page.unroute("**/rest/v1/day_plans**");
  await sheet.getByRole("button", { name: "Goodnight" }).click();
  await expect(sheet.getByText("+1 Night ticket. Sleep well.")).toBeVisible();
  await expect.poll(async () => (await dayPlans(id)).some((r) => r.bedtime_override)).toBe(true);
});
