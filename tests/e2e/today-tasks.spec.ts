import { expect, test } from "@playwright/test";
import { expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { addBacklogItem, backlogItems, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { localDate } from "@/lib/time";

/** Playtest R1 R5: the tasks planned into a block show on Today while that block runs. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("R5: Today's current block lists its planned tasks; ticking one finishes it", async ({ page }) => {
  const email = uniqueEmail("r5");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 150); // Work is running
  const day = localDate(new Date(Date.now() - 150 * 60_000), "Asia/Bangkok");
  await addBacklogItem(id, {
    title: "Report draft",
    status: "scheduled",
    scheduled_date: day,
    block: "work",
  });
  await addBacklogItem(id, { title: "Email prof", status: "scheduled", scheduled_date: day, block: null });
  await addBacklogItem(id, { title: "Gym bag", status: "scheduled", scheduled_date: day, block: "free" });

  await page.goto("/today");
  const card = page.getByRole("region", { name: "Current block" });
  const tasks = card.getByRole("region", { name: "Planned tasks" });
  await expect(tasks.getByRole("checkbox")).toHaveCount(2); // Work's own + the unassigned (Work by default)
  await expect(tasks.getByRole("checkbox", { name: "Gym bag" })).toHaveCount(0);
  await tasks.getByRole("checkbox", { name: "Report draft" }).click();
  await expect(tasks.getByRole("checkbox", { name: "Report draft" })).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => (await backlogItems(id)).find((i) => i.title === "Report draft")?.status)
    .toBe("done");
  await expectTouchTargets(page);
});
