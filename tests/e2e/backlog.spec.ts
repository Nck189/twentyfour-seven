import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { addBacklogItem, backlogItems, gameState, setAllTemplates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, localDate } from "@/lib/time";

/** M5 Backlog journeys (CJ-11). Every day is a free day (Work 9 h, no fixed events). */
test.skip(IS_PROD_RUN, "creates dedicated users");

const tomorrow = () => addDays(localDate(new Date(), "Asia/Bangkok"), 1);

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
  // 600 min planned vs 540 free in Work (hand calculation) → over by 1 h.
  await expect(page.getByText("Over by 1h")).toBeVisible();
  await expect(page.getByText("1 task")).toBeVisible();
});

test("CJ-11 drag a task onto a day (mouse)", async ({ page, isMobile }) => {
  test.skip(isMobile, "touch drag is checked on a real iPhone; Move to… covers touch here");
  const id = await setup(page);
  await addBacklogItem(id, { title: "Read paper", estimate_min: 60 });
  await page.goto("/plan");
  const handle = page.getByRole("button", { name: "Drag Read paper" });
  const target = page.getByRole("button", { name: "Plan Tomorrow" });
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
  await expect(page.getByText("1h of 9h free")).toBeVisible();
});

test("finishing a task grants coins once (server-side)", async ({ page }) => {
  const id = await setup(page);
  await addBacklogItem(id, { title: "Pay rent", priority: "should" });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Edit Pay rent" }).click();
  const sheet = page.getByRole("dialog", { name: "Pay rent" });
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet.getByText("+20 coins")).toBeVisible();
  expect((await gameState(id)).coins).toBe(20);
  await sheet.getByRole("button", { name: "Not done yet" }).click();
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
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
