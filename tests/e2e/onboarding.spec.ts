import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { profile, setWakeMinutesAgo, settingsBlocks, templates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** First-run setup (Minnie, 2026-11-03): sleep times, weekdays, first-10s; skippable; editable later. */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function newUser(page: Page) {
  const email = uniqueEmail("ob");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  return userIdFor(email);
}

test("first open offers setup on Today; Later hides it for good", async ({ page }) => {
  const id = await newUser(page);
  await page.goto("/today");
  const card = page.getByRole("region", { name: "Make 24/7 yours in 2 minutes" });
  await expect(card).toBeVisible();
  await expectTouchTargets(page);
  await card.getByRole("button", { name: "Later" }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(async () => (await profile(id)).onboarding).toMatchObject({ skipped: true });
  await page.reload();
  await expect(page.getByRole("button", { name: "See the whole day" })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("lazy path: Student → Next → Use all suggestions → done (4 taps)", async ({ page }) => {
  const id = await newUser(page);
  await page.goto("/today");
  await page.getByRole("link", { name: "Set up now" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await page.getByRole("button", { name: /Student/ }).click();
  const week = page.getByRole("region", { name: "Your week" });
  await expect(week.getByRole("heading", { name: "School day" })).toBeVisible();
  await expect(week.getByRole("button", { name: /Class 09:00–16:00/ })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Use all suggestions" }).click();
  await expect(page.getByText("All set")).toBeVisible();

  await expect.poll(async () => (await profile(id)).onboarding).toMatchObject({ done: true });
  const tpls = await templates(id);
  const school = tpls.find((t) => t.key === "school_day")!;
  expect(school).toMatchObject({ auto_apply: true, weekdays: [1, 2, 3, 4, 5], target_wake: "07:30:00" });
  expect(school.fixed_events).toEqual([
    { id: "class", key: "class", title: null, start: "09:00", end: "16:00" },
  ]);
  // Old kinds stop claiming weekdays.
  expect(tpls.filter((t) => t.auto_apply && (t.weekdays as number[]).includes(3))).toHaveLength(1);
  const blocks = await settingsBlocks(id);
  expect(blocks.find((b) => b.key === "focus")).toMatchObject({ first10: "@s:focus:1" });
  expect(blocks.find((b) => b.key === "work")).toMatchObject({ first10: null }); // built-in default kept
});

test("my own: sleep times + weekdays + a class slot, then first-10s one block at a time", async ({
  page,
}) => {
  const id = await newUser(page);
  await page.goto("/welcome");
  await page.getByRole("button", { name: /My own/ }).click();
  const week = page.getByRole("region", { name: "Your week" });
  // Same sleep every day in one tap, then fine-tune the first kind.
  await week.getByRole("group", { name: "Same sleep every day" }).getByRole("button").first().click();
  const first = week.getByRole("listitem").first();
  await first.getByLabel("Bed").fill("23:30");
  await first.getByLabel("Wake").fill("07:30");
  await expect(first.getByText("8h sleep")).toBeVisible();
  await first.getByRole("button", { name: "W" }).first().click();
  await first.getByRole("button", { name: "Add class or work time" }).click();
  await first.getByRole("radio", { name: "Work" }).click();
  await first.getByLabel("Work starts").fill("13:00");
  await first.getByLabel("Work ends").fill("17:00");
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Next" }).click();

  // First-10: pick the 1st suggestion for Wake → Focus slides in by itself; add an own one.
  await page.getByRole("radiogroup", { name: "Wake" }).getByRole("radio").nth(1).click();
  await expect(page.getByRole("radiogroup", { name: "Focus" })).toBeVisible();
  await page.getByRole("textbox", { name: "Add your own" }).fill("Open Figma");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Work" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("All set")).toBeVisible();

  const blocks = await settingsBlocks(id);
  expect(blocks.find((b) => b.key === "wake")).toMatchObject({ first10: "@s:wake:1" });
  expect(blocks.find((b) => b.key === "focus")).toMatchObject({
    first10: "Open Figma",
    first10_options: ["Open Figma"],
  });
  const tpls = await templates(id);
  const free = tpls.find((t) => t.key === "free_weekday")!;
  expect(free.target_wake).toBe("07:30:00");
  expect((free.blocks as { sleep?: { duration_min: number } }).sleep?.duration_min).toBe(480);
  expect(free.weekdays).toContain(3);
  expect(free.fixed_events).toEqual([expect.objectContaining({ key: "work", start: "13:00", end: "17:00" })]);
});

test("import a timetable (.ics): weekly slots become kinds of day", async ({ page }) => {
  const id = await newUser(page);
  await page.goto("/welcome?step=week&from=more");
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "SUMMARY:Operations Research",
    "DTSTART;TZID=Asia/Bangkok:20261102T090000",
    "DTEND;TZID=Asia/Bangkok:20261102T120000",
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  await page
    .getByLabel("Import from a calendar file (.ics)")
    .setInputFiles({ name: "timetable.ics", mimeType: "text/calendar", buffer: Buffer.from(ics) });
  await expect(page.getByRole("status")).toContainText("Imported 2 kinds of day");
  await expect(page.getByRole("heading", { name: "Operations Research" })).toBeVisible();
  const tpls = (await templates(id)).filter((t) => t.auto_apply);
  expect(tpls.find((t) => t.key === "sched_1")).toMatchObject({ weekdays: [1, 3], target_wake: "07:30:00" });
  expect(tpls.find((t) => t.key === "day_off")).toMatchObject({ weekdays: [2, 4, 5, 6, 7] });
});

test("no first-10s at all is allowed (with a gentle note)", async ({ page }) => {
  const id = await newUser(page);
  await page.goto("/welcome?step=first10&from=more");
  await page.getByRole("switch", { name: "Use first-10 actions (recommended)" }).click();
  await expect(page.getByRole("note")).toContainText("harder to start");
  await expect.poll(async () => (await settingsBlocks(id)).every((b) => b.first10 === "")).toBe(true);
});

test("Today: switch today's first-10 from the block card", async ({ page }) => {
  const id = await newUser(page);
  await setWakeMinutesAgo(id, 150); // Work
  await page.goto("/today");
  const card = page.getByRole("region", { name: "Current block" });
  await expect(card.getByRole("checkbox", { name: /Map the day/ })).toBeVisible();
  await card.getByRole("button", { name: "Change today's first 10 minutes" }).click();
  await card
    .getByRole("radiogroup", { name: "Change today's first 10 minutes" })
    .getByRole("radio", { name: /smallest Must/ })
    .click();
  await expect(card.getByRole("checkbox", { name: /smallest Must/ })).toBeVisible();
});

test("More → Setup opens each part to edit later", async ({ page }) => {
  await newUser(page);
  await page.goto("/more");
  await page.getByRole("link", { name: "First 10 minutes" }).click();
  await expect(page).toHaveURL(/step=first10/);
  await expect(page.getByRole("heading", { name: "Your first 10 minutes" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/more$/);
});
