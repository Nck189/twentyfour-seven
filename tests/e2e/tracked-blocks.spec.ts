import { expect, test } from "@playwright/test";
import { expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { blockLogs, dayPlans, setWakeMinutesAgo, settingsBlocks, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** Rules B and C (Minnie OK 2026-11-27): choose the blocks you track; adjust the current block. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("B: an untracked block has no check-in on Today; More → Set up turns it off and on", async ({
  page,
}) => {
  const email = uniqueEmail("trk");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await page.goto("/more/setup");
  const card = page.getByRole("region", { name: "Blocks I track" });
  await expect(card.getByText("Always tracked: Wake, Down Time, Sleep", { exact: false })).toBeVisible();
  await card.getByRole("checkbox", { name: "Focus" }).click();
  await expect(card.getByRole("status")).toHaveText("Saved.");
  await expect(card.getByRole("checkbox", { name: "Focus" })).toHaveAttribute("aria-checked", "false");
  expect((await settingsBlocks(id)).find((b) => b.key === "focus")).toMatchObject({
    tracked: false,
  });
  await expectTouchTargets(page);

  await setWakeMinutesAgo(id, 100); // Focus is running
  await page.goto("/today");
  const now = page.getByRole("region", { name: "Current block" });
  await expect(now.getByText(/not tracking this block/)).toBeVisible();
  await expect(now.getByRole("button", { name: "Start" })).toHaveCount(0);
  await now.getByRole("button", { name: "Check in anyway" }).click();
  await expect(page.getByRole("dialog", { name: "Focus" })).toBeVisible();
});

test("C: Adjust this block stretches it for today, and Not today sets it aside as planned", async ({
  page,
}) => {
  const email = uniqueEmail("adj");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 100); // Focus is running, not started
  await page.goto("/today");
  const now = page.getByRole("region", { name: "Current block" });
  await now.getByText("Adjust this block").click();
  const ends = await now.getByText(/^Ends at/).textContent();
  await now.getByRole("button", { name: "+15 min" }).click();
  await expect(now.getByRole("status").filter({ hasText: "Saved for today." })).toBeVisible();
  await expect
    .poll(async () => {
      const plans = (await dayPlans(id)) as {
        overrides: { blocks?: { focus?: { duration_min?: number } } };
      }[];
      return plans.map((p) => p.overrides.blocks?.focus?.duration_min).find(Boolean);
    })
    .toBe(105);
  await expect(now.getByText(/^Ends at/)).not.toHaveText(ends ?? "");
  await expectTouchTargets(page);

  await now.getByRole("button", { name: "Not today" }).click();
  await expect
    .poll(async () =>
      ((await blockLogs(id)) as { block: string; planned_deviation: boolean }[]).find(
        (l) => l.block === "focus",
      ),
    )
    .toMatchObject({ planned_deviation: true });
});
