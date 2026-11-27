import { expect, test } from "@playwright/test";
import { expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { blockLogs, dayPlans, rest, setWakeMinutesAgo, settingsBlocks, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** Rules B and C (Minnie OK 2026-11-27): choose the blocks you track; adjust the day on Today. */
test.skip(IS_PROD_RUN, "creates dedicated users");

type Block = { key: string; tracked_log?: { from: string; tracked: boolean }[] };

test("B: More → Set up turns a block off from tomorrow; an untracked block has no check-in on Today", async ({
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
  await expect(card.getByRole("status")).toHaveText("Saved. It starts tomorrow.");
  await expect(card.getByRole("checkbox", { name: "Focus" })).toHaveAttribute("aria-checked", "false");
  await expect(card.getByText("Starts tomorrow", { exact: true })).toBeVisible();
  const log = ((await settingsBlocks(id)) as Block[]).find((b) => b.key === "focus")?.tracked_log;
  expect(log).toHaveLength(1);
  expect(log![0]).toMatchObject({ tracked: false });
  await expectTouchTargets(page);

  // Make it start today (test setup, service role), with Focus running.
  const blocks = ((await settingsBlocks(id)) as Block[]).map((b) =>
    b.key === "focus" ? { ...b, tracked_log: [{ from: "2020-01-01", tracked: false }] } : b,
  );
  await rest(`settings?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ blocks }) });
  await setWakeMinutesAgo(id, 100);
  await page.goto("/today");
  const now = page.getByRole("region", { name: "Current block" });
  await expect(now.getByText(/not tracking this block/)).toBeVisible();
  await expect(now.getByRole("button", { name: "Start" })).toHaveCount(0);
  await now.getByRole("button", { name: "Check in anyway" }).click();
  await expect(page.getByRole("dialog", { name: "Focus" })).toBeVisible();
});

test("C: Not today sets the next block aside before it starts, with Undo", async ({ page }) => {
  const email = uniqueEmail("skip");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 45); // Wake now; Focus starts in 15 min
  await page.goto("/today");
  await page.getByRole("button", { name: "Not today" }).click();
  await expect(page.getByText(/· Not today/)).toBeVisible();
  const focusLog = async () =>
    ((await blockLogs(id)) as { block: string; planned_deviation: boolean }[]).find(
      (l) => l.block === "focus",
    );
  await expect.poll(focusLog).toMatchObject({ planned_deviation: true });
  await expectTouchTargets(page);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(focusLog).toMatchObject({ planned_deviation: false });
});

test("C: Adjust this block stretches it for today", async ({ page }) => {
  const email = uniqueEmail("adj");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 100); // Focus is running
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
});
