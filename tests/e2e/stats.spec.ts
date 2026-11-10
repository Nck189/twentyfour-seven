import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, setAllTemplates, userIdFor } from "../helpers/db";
import { wakeDay } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, zonedInstant } from "@/lib/time";

/** M10 Stats + weekly review (SPEC §7). */
test.skip(IS_PROD_RUN, "creates dedicated users");

const TZ = "Asia/Bangkok";

async function setup(page: Page) {
  const email = uniqueEmail("stats");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  return id;
}

/** 10 finished days: a wake each morning (one late), Focus on time, Work missed for "phone". */
async function seedDays(id: string) {
  const today = wakeDay();
  // The account is older than its data (Stats and the review never look before sign-up).
  await rest(`profiles?user_id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ created_at: zonedInstant(addDays(today, -12), 6 * 60, TZ).toISOString() }),
  });
  const days = Array.from({ length: 10 }, (_, i) => addDays(today, -10 + i));
  await rest("wake_events", {
    method: "POST",
    body: JSON.stringify(
      days.map((d, i) => ({
        user_id: id,
        date: d,
        target_wake: zonedInstant(d, 600, TZ).toISOString(),
        pressed_at: zonedInstant(d, i === 6 ? 760 : 600 + (i % 3) * 4, TZ).toISOString(),
        in_window: i !== 6,
        backfilled: false,
      })),
    ),
  });
  await rest("block_logs", {
    method: "POST",
    body: JSON.stringify(
      days.flatMap((d) => [
        {
          user_id: id,
          date: d,
          block: "focus",
          planned_start: zonedInstant(d, 660, TZ).toISOString(),
          started_at: zonedInstant(d, 663, TZ).toISOString(),
          first10_at: zonedInstant(d, 670, TZ).toISOString(),
          location: "home",
          miss_reason: null,
        },
        // A bulk insert needs the same keys in every row (PostgREST PGRST102).
        {
          user_id: id,
          date: d,
          block: "work",
          planned_start: null,
          started_at: null,
          first10_at: null,
          location: "out",
          miss_reason: "phone",
        },
      ]),
    ),
  });
}

test("CJ-M10-1 Stats shows the charts from the data; the weekly review pays +3 once (on Sunday/Monday)", async ({
  page,
}) => {
  const id = await setup(page);
  await seedDays(id);
  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Stats", level: 1 })).toBeVisible();
  // Overview: the day score in plain words (no "OEE"), the wake and streak tiles.
  await expect(page.getByRole("region", { name: "Day score" })).toContainText("Last 7 days");
  await expect(page.getByText("Usually up at")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("OEE");
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);

  const tabs = page.getByRole("radiogroup", { name: "Stats view" });
  await tabs.getByRole("radio", { name: "Sleep" }).click();
  await expect(page.getByRole("region", { name: "Wake-up time" }).getByRole("img")).toHaveAttribute(
    "aria-label",
    /Wake-up times: usually \d\d:\d\d/,
  );
  await expect(page.getByRole("region", { name: "Day score" })).toHaveCount(0);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);

  await tabs.getByRole("radio", { name: "Days" }).click();
  await expect(page.getByRole("region", { name: "Why blocks got missed" })).toContainText(
    "Top reason: Phone",
  );
  await expect(page.getByRole("region", { name: "Which days go well" }).getByRole("table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Home vs out" })).toContainText("At home");
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);

  await tabs.getByRole("radio", { name: "Overview" }).click();
  const review = page.getByRole("region", { name: "Weekly review" });
  // The review is open on the week's Sunday and the Monday after (by wake-day) only.
  if (await review.isVisible()) {
    await review.getByLabel("Keep").fill("Focus on time every day");
    await review.getByLabel("Problem").fill("Phone during Work");
    await review.getByLabel("Try").fill("Phone in the bag at 13:00");
    await review.getByRole("button", { name: "Save · +3 tickets" }).click();
    await expect(review.getByRole("status")).toContainText("+3 tickets");
    expect((await gameState(id)).tickets).toBe(3);
    await page.reload();
    await expect(page.getByRole("region", { name: "Weekly review" })).toContainText("review is done");
  }
});
