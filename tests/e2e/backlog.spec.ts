import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { addBacklogItem, backlogItems, gameState, setAllTemplates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, localDate } from "@/lib/time";
import { wakeDay } from "../helpers/day";

/** M5 Backlog journeys (CJ-11). Every day is a free day (Work 9 h, no fixed events). */
test.skip(IS_PROD_RUN, "creates dedicated users");

// Flake hunt (one-tap finish stuck on "Loading…" on Linux WebKit): on failure, print the
// requests that never finished and the console errors, since traces can't be downloaded here.
const pending = new Map<string, string>();
const consoleErrors: string[] = [];
test.beforeEach(({ page }) => {
  pending.clear();
  consoleErrors.length = 0;
  page.on("request", (r) => pending.set(`${r.method()} ${r.url()}`, new Date().toISOString()));
  page.on("requestfinished", (r) => pending.delete(`${r.method()} ${r.url()}`));
  page.on("requestfailed", (r) => {
    pending.delete(`${r.method()} ${r.url()}`);
    consoleErrors.push(`requestfailed ${r.url()} ${r.failure()?.errorText ?? ""}`);
  });
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`console ${m.text().slice(0, 300)}`));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror ${e.message.slice(0, 300)}`));
});
test.afterEach(({ page }, info) => {
  void page; // Playwright wants the first argument destructured
  if (info.status === info.expectedStatus) return;
  console.log(`[diag] ${info.title}: unfinished requests:`, [...pending.entries()]);
  console.log(`[diag] errors:`, consoleErrors);
});

/** Plan's "Tomorrow": the wake-day + 1 (every day wakes at 10:00 here). */
const tomorrow = () => addDays(wakeDay(), 1);

async function setup(page: Page) {
  const email = uniqueEmail("m5");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  return id;
}

test("quick capture: type + Enter lands in the Inbox", async ({ page }) => {
  const id = await setup(page);
  await page.goto("/plan");
  const box = page.getByRole("textbox", { name: "Add to backlog" });
  await box.fill("Email advisor");
  await box.press("Enter");
  await expect(page.getByRole("list", { name: "Inbox" }).getByText("Email advisor")).toBeVisible();
  await expect(box).toHaveValue("");
  await expect.poll(async () => (await backlogItems(id)).map((i) => i.title)).toEqual(["Email advisor"]);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
});

test("type once: estimate, priority, day and project are read from one line", async ({ page }) => {
  const id = await setup(page);
  await page.goto("/plan");
  const box = page.getByRole("textbox", { name: "Add to backlog" });
  await box.fill("Report 30m !must tomorrow #yop");
  await expect(page.getByText("Will be saved with:")).toBeAttached();
  await box.press("Enter");
  await expect
    .poll(async () => (await backlogItems(id))[0])
    .toMatchObject({
      title: "Report",
      estimate_min: 30,
      priority: "must",
      scheduled_date: tomorrow(),
      block: "work",
      status: "scheduled",
      tag: "yop",
    });
  // This week's tasks live on the strip + day card (not in a second list).
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await expect(page.getByRole("list", { name: "Tasks for Tomorrow" })).toContainText("Report");
});

test("one tap on the circle finishes a task and shows the coins", async ({ page }) => {
  const id = await setup(page);
  await addBacklogItem(id, { title: "Wash dishes", priority: "just_start" });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Finish Wash dishes" }).click();
  await expect(page.getByRole("status", { name: "+10 coins" })).toBeAttached();
  await expect.poll(async () => (await gameState(id)).coins).toBe(10);
  await expect.poll(async () => (await backlogItems(id))[0].status).toBe("done");
  await expect(page.getByRole("list", { name: "Inbox" })).toHaveCount(0);
});

test("CJ-11 Move to… lands in that day's Work block; the capacity bar turns red when over", async ({
  page,
}) => {
  const id = await setup(page);
  await addBacklogItem(id, { title: "Thesis draft", estimate_min: 600, priority: "must" });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Edit Thesis draft" }).click();
  const sheet = page.getByRole("dialog", { name: "Thesis draft" });
  await sheet.getByRole("radiogroup", { name: "Move to…" }).getByRole("radio", { name: "Tomorrow" }).click();
  await expect
    .poll(async () => (await backlogItems(id))[0])
    .toMatchObject({ scheduled_date: tomorrow(), block: "work", status: "scheduled" });
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  const card = page.getByRole("region", { name: "Tomorrow" });
  // 600 min planned vs 540 free in Work (hand calculation) → over by 1 h.
  await expect(card.getByText("Over by 1h")).toBeVisible();
  await expect(card.getByRole("list", { name: "Tasks for Tomorrow" })).toContainText("Thesis draft");
});

test("CJ-11 drag a task onto a day (mouse)", async ({ page, isMobile }) => {
  test.skip(isMobile, "touch drag is checked on a real iPhone; Move to… covers touch here");
  const id = await setup(page);
  await addBacklogItem(id, { title: "Read paper", estimate_min: 60 });
  await page.goto("/plan");
  const handle = page.getByRole("button", { name: "Drag Read paper" });
  const target = page.getByRole("button", { name: "Tomorrow", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 20, { steps: 5 });
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(async () => (await backlogItems(id))[0])
    .toMatchObject({ scheduled_date: tomorrow(), block: "work", status: "scheduled" });
  // dnd-kit swallows a click that lands right after a drop: retry until the day is selected.
  await expect(async () => {
    await target.click();
    await expect(target).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
  await expect(page.getByRole("region", { name: "Tomorrow" }).getByText("1h of 9h free")).toBeVisible();
});

test("finishing a task grants coins once (server-side)", async ({ page }) => {
  const id = await setup(page);
  await addBacklogItem(id, { title: "Pay rent", priority: "should" });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Edit Pay rent" }).click();
  const sheet = page.getByRole("dialog", { name: "Pay rent" });
  await sheet.getByRole("button", { name: "Mark task finished" }).click();
  await expect(sheet.getByText("+20 coins")).toBeVisible();
  expect((await gameState(id)).coins).toBe(20);
  await sheet.getByRole("button", { name: "Not done yet" }).click();
  await sheet.getByRole("button", { name: "Mark task finished" }).click();
  await expect(sheet.getByText("Done again — coins only count once")).toBeVisible();
  expect((await gameState(id)).coins).toBe(20);
});

test("Night ritual: an unfinished task planned for today is carried to tomorrow", async ({ page }) => {
  const id = await setup(page);
  // Down Time now: wake 15h10m ago (see night-plan.spec.ts).
  const wake = new Date(Date.now() - 910 * 60_000);
  const wakeDate = localDate(wake, "Asia/Bangkok");
  test.skip(wakeDate !== localDate(new Date(), "Asia/Bangkok"), "wake would be on yesterday's date");
  const hh = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(wake);
  await setAllTemplates(id, hh);
  await addBacklogItem(id, {
    title: "Slides",
    status: "scheduled",
    scheduled_date: wakeDate,
    block: "work",
  });
  await page.goto("/today");
  const sheet = page.getByRole("dialog", { name: "Night ritual" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Next" }).click();
  const carry = sheet.getByRole("group", { name: "Slides" });
  await carry.getByRole("button", { name: "Tomorrow" }).click();
  await expect
    .poll(async () => (await backlogItems(id))[0])
    .toMatchObject({ scheduled_date: addDays(wakeDate, 1), status: "scheduled", carry_count: 1 });
});

test("R-M5-3: a capture that fails to save keeps the typed text; it saves on the next Enter", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "WebKit can't intercept requests to the local API");
  const id = await setup(page);
  await page.goto("/plan");
  const box = page.getByRole("textbox", { name: "Add to backlog" });
  await page.route("**/rest/v1/backlog_items**", (r) =>
    r.request().method() === "POST" ? r.abort("internetdisconnected") : r.continue(),
  );
  await box.fill("Email advisor about chapter 3");
  await box.press("Enter");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(box).toHaveValue("Email advisor about chapter 3");
  await page.unroute("**/rest/v1/backlog_items**");
  await box.press("Enter");
  await expect(box).toHaveValue("");
  await expect
    .poll(async () => (await backlogItems(id)).map((i) => i.title))
    .toEqual(["Email advisor about chapter 3"]);
});

test("R-M5-4 / R-M4-10: a failed load says so with Retry (never 'Nothing here' or 'Loading…' forever)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "WebKit can't intercept requests to the local API");
  await setup(page);
  await page.route("**/rest/v1/backlog_items**", (r) => r.abort("internetdisconnected"));
  await page.goto("/plan");
  const alert = page.getByRole("alert").filter({ hasText: "Couldn't load your tasks." });
  await expect(alert).toBeVisible();
  await expect(page.getByText("Nothing here yet", { exact: false })).toHaveCount(0);
  await page.unroute("**/rest/v1/backlog_items**");
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(alert).toHaveCount(0);

  await page.route("**/rest/v1/templates**", (r) => r.abort("internetdisconnected"));
  await page.reload();
  const planAlert = page.getByRole("alert").filter({ hasText: "Couldn't load your plan." });
  await expect(planAlert).toBeVisible();
  await page.unroute("**/rest/v1/templates**");
  await planAlert.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("textbox", { name: "Add to backlog" })).toBeVisible();
});

test("R-M5-2: finishing a task on the day card keeps its row (coins pop, nothing shifts); done can be undone", async ({
  page,
}) => {
  const id = await setup(page);
  const planned = { scheduled_date: tomorrow(), block: "work", status: "scheduled", priority: "just_start" };
  await addBacklogItem(id, { title: "Slides", ...planned });
  await addBacklogItem(id, { title: "Email", ...planned });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  const list = page.getByRole("list", { name: "Tasks for Tomorrow" });
  const first = list.getByRole("button", { name: "Finish Slides" });
  await first.click();
  await expect(page.getByRole("status", { name: "+10 coins" })).toBeAttached();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  // A quick second tap on the same spot doesn't finish the next task.
  await first.click({ force: true });
  await expect(list.getByRole("button", { name: "Finish Email" })).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => (await backlogItems(id)).find((i) => i.title === "Email")?.status)
    .toBe("scheduled");
  // Undo from the sheet.
  await list.getByRole("button", { name: "Edit Slides" }).click();
  await page.getByRole("button", { name: "Not done yet" }).click();
  await expect
    .poll(async () => (await backlogItems(id)).find((i) => i.title === "Slides")?.status)
    .toBe("scheduled");
});

test("R-M4-6: 'tomorrow' in Plan is the Night ritual's tomorrow (a day runs wake → next wake)", async ({
  page,
}) => {
  const id = await setup(page); // every day wakes at 10:00
  await page.goto("/plan");
  const box = page.getByRole("textbox", { name: "Add to backlog" });
  await box.fill("Call prof tomorrow");
  await box.press("Enter");
  await expect.poll(async () => (await backlogItems(id))[0]?.scheduled_date).toBe(addDays(wakeDay(), 1));
});
