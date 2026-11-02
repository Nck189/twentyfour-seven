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

test("setup: sleep times + weekdays, then a first-10 per block in a few taps", async ({ page }) => {
  const id = await newUser(page);
  await page.goto("/today");
  await page.getByRole("link", { name: "Set up now" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  // Sleep: the first kind of day (free weekdays) → bed 23:30, wake 07:30 (8 h).
  const first = page.getByRole("region", { name: "Sleep times" }).getByRole("listitem").first();
  await first.getByLabel("Bed").fill("23:30");
  await first.getByLabel("Wake").fill("07:30");
  await expect(first.getByText("8h sleep")).toBeVisible();
  // Move Wednesday into this kind of day.
  await first.getByRole("button", { name: "W" }).first().click();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Next" }).click();

  // First-10: pick the 1st suggestion for Wake → Focus slides in by itself.
  await page.getByRole("radiogroup", { name: "Wake" }).getByRole("radio").nth(1).click();
  await expect(page.getByRole("radiogroup", { name: "Focus" })).toBeVisible();
  await page.getByRole("textbox", { name: "Add your own" }).fill("Open Figma");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Work" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("All set")).toBeVisible();

  await expect.poll(async () => (await profile(id)).onboarding).toMatchObject({ done: true });
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
  expect(tpls.filter((t) => (t.weekdays as number[]).includes(3)).length).toBe(1);
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
