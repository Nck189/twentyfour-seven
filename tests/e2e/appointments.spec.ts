import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { backlogItems, dayPlans, setAllTemplates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, localDate } from "@/lib/time";

/** Appointments any distance ahead (Minnie: "the dentist or a friend can book me months ahead"). */
test.skip(IS_PROD_RUN, "creates dedicated users");

const TZ = "Asia/Bangkok";

async function setup(page: Page) {
  const email = uniqueEmail("appt");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00"); // free days: Work 12:30–21:30
  return id;
}

type Ev = { key: string; title: string; start: string; end: string; host?: string };
const eventsOn = async (id: string, date: string) =>
  ((await dayPlans(id)).find((r) => r.date === date)?.overrides as { fixed_events?: Ev[] } | undefined)
    ?.fixed_events ?? null;

/** The month view's day button name, e.g. "Saturday 12 December". */
const dayName = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

test("a dentist 40 days ahead: one line → that day's plan, the next-appointment line, the month view", async ({
  page,
}) => {
  const id = await setup(page);
  const today = localDate(new Date(), TZ);
  const date = addDays(today, 40);
  const [, m, d] = date.split("-").map(Number);

  await page.goto("/plan");
  const box = page.getByRole("textbox", { name: "Add to backlog" });
  await box.fill(`Dentist ${d}/${m} 14:00`);
  await expect(page.getByText("Will be saved with:")).toBeAttached();
  await box.press("Enter");

  // Saved on that day's plan (not the template, not the backlog), held by Work at 14:00.
  await expect
    .poll(() => eventsOn(id, date))
    .toMatchObject([{ key: "appointment", title: "Dentist", start: "14:00", end: "15:00", host: "work" }]);
  expect(await backlogItems(id)).toEqual([]);

  // The day card jumps to that date and lists it.
  const appts = page.getByRole("list", { name: "Appointments" });
  await expect(appts).toContainText("Dentist");
  await expect(appts).toContainText("14:00–15:00");

  // After a reload (far-ahead days are loaded too) the next appointment shows under the week.
  await page.reload();
  const next = page.getByRole("button", { name: /^Next appointment: Dentist/ });
  await expect(next).toBeVisible();
  await expect(appts).toHaveCount(0); // today is selected again

  // Month view: step forward to that month; the day has a dot and opens on tap.
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const months =
    (Number(date.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
    Number(date.slice(5, 7)) -
    Number(today.slice(5, 7));
  for (let i = 0; i < months; i++) await page.getByRole("button", { name: "Next month" }).click();
  const cell = page.getByRole("button", { name: dayName(date), exact: true });
  await expect(cell).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await cell.click();
  await expect(appts).toContainText("Dentist");

  // Remove it from the day card.
  await page.getByRole("button", { name: "Remove Dentist" }).click();
  await expect(appts).toHaveCount(0);
  await expect.poll(() => eventsOn(id, date)).toEqual([]);
  await expect(next).toHaveCount(0);
});

test("a date without a time plans a task that day; next year's date when this year's has passed", async ({
  page,
}) => {
  const id = await setup(page);
  const today = localDate(new Date(), TZ);
  const yesterday = addDays(today, -1);
  const [y, m, d] = yesterday.split("-").map(Number);
  test.skip(m === 2 && d === 29, "29/2 waits for the next leap year (unit-tested)");

  await page.goto("/plan");
  const box = page.getByRole("textbox", { name: "Add to backlog" });
  await box.fill(`Renew passport ${d}/${m}`);
  await box.press("Enter");
  // Yesterday's d/m without a year means next year (the same date, a year ahead).
  const nextYear = `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  await expect
    .poll(async () => (await backlogItems(id))[0])
    .toMatchObject({ title: "Renew passport", scheduled_date: nextYear, status: "scheduled" });
  expect(await eventsOn(id, nextYear)).toBeNull();
});
