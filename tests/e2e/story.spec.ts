import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setAllTemplates, userIdFor } from "../helpers/db";
import { calmBlockClock, gotoToday, leaveAfterSignIn, setBlockNow, wakeDay } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/** Story beats with Som (docs/STORY.md): a calm moment, skippable, once, recorded by the server. */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function setup(page: Page, { calm = true }: { calm?: boolean } = {}) {
  // Independent of the hour the suite runs (the wake window / Down Time make Som wait).
  if (calm) await calmBlockClock(page);
  const email = uniqueEmail("story");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email, { story: true });
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  return id;
}

test("CJ-S-1 the first Farm visit meets Som: Next through the panels, then it never replays that day", async ({
  page,
}) => {
  const id = await setup(page);
  await page.goto("/farm");
  const scene = page.getByRole("dialog", { name: "Som" });
  await expect(scene).toBeVisible();
  await expect(scene.getByText("An orange cat is napping by the old gate.")).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  for (let i = 0; i < 3; i++) await scene.getByRole("button", { name: "Next" }).click();
  await expect(scene.getByText("Som follows you in. The farm has a cat now.")).toBeVisible();
  await scene.getByRole("button", { name: "Done" }).click();
  await expect(scene).toHaveCount(0);
  expect(await rest(`story_seen?user_id=eq.${id}&select=beat`)).toEqual([{ beat: "ch0_gate" }]);
  // One beat a day, never twice: a later visit is calm even once a harvest makes chapter 1 ready.
  await rest("events", {
    method: "POST",
    body: JSON.stringify({ user_id: id, type: "harvest", payload: {} }),
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Farm", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("CJ-S-2 Skip closes a beat at once; its gift is already in the inventory", async ({ page }) => {
  const id = await setup(page);
  // Chapter 0 was seen on an earlier day; a harvest makes chapter 1 ready.
  await rest("story_seen", {
    method: "POST",
    body: JSON.stringify({ user_id: id, beat: "ch0_gate", day: "2000-01-01" }),
  });
  await rest("events", {
    method: "POST",
    body: JSON.stringify({ user_id: id, type: "harvest", payload: {} }),
  });
  await page.goto("/farm");
  const scene = page.getByRole("dialog", { name: "First harvest" });
  await expect(scene).toBeVisible();
  await scene.getByRole("button", { name: "Skip" }).click();
  await expect(scene).toHaveCount(0);
  expect(await rest(`inventory?user_id=eq.${id}&item_id=eq.seed:radish&select=qty`)).toEqual([{ qty: 1 }]);
});

test("CJ-S-3 More: sound, quiet during Focus/Work and skip animations are switches", async ({ page }) => {
  await setup(page);
  await page.goto("/more");
  const card = page.locator("#sound");
  const sound = card.getByRole("switch", { name: "Sounds", exact: true });
  await expect(sound).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("switch", { name: /Quiet during Focus and Work/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", "false");
  await expect(card.getByRole("switch", { name: /Quiet during Focus and Work/ })).toBeDisabled();
  await page.reload();
  await expect(page.locator("#sound").getByRole("switch", { name: "Sounds", exact: true })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expectTouchTargets(page);
});

test("CJ-S-4 exam day: an appointment called 'Midterm' brings Som with a headband to Today", async ({
  page,
}) => {
  const id = await setup(page);
  await rest("day_plans", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      date: wakeDay(),
      overrides: {
        fixed_events: [
          { id: "e1", key: "appointment", title: "Midterm IE", start: "13:00", end: "15:00", host: "work" },
        ],
      },
    }),
  });
  await gotoToday(page);
  await expect(page.getByRole("region", { name: "Exam day" })).toContainText(
    "Exam day! Som packed you a snack.",
  );
  await expectTouchTargets(page);
});

test("G7 STORY-R1: leaving the Farm while a beat's claim is in flight doesn't lose the scene", async ({
  page,
}) => {
  await setup(page);
  // A slow network: the claim answers only after the user has already left the Farm.
  await page.route("**/rest/v1/rpc/claim_story_beat", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto("/farm");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Today" })
    .click();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await page.waitForTimeout(3500); // the claim has been granted on the server by now
  await page.unroute("**/rest/v1/rpc/claim_story_beat");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Farm" }).click();
  await expect(page.getByRole("dialog", { name: "Som" })).toBeVisible();
});

test("G7 STORY-R6: Som waits during the wake window and Down Time, and comes at a calm block", async ({
  page,
}) => {
  const id = await setup(page, { calm: false });
  const scene = page.getByRole("dialog", { name: "Som" });
  await page.goto("/more"); // on the app's origin (More doesn't save a day)
  for (const busy of ["wake", "down"] as const) {
    await setBlockNow(page, busy);
    await page.goto("/farm");
    await expect(page.getByRole("heading", { name: "Farm", level: 1 })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(scene).toHaveCount(0);
  }
  expect(await rest(`story_seen?user_id=eq.${id}&select=beat`)).toEqual([]);
  await setBlockNow(page, "focus");
  await page.goto("/farm");
  await expect(scene).toBeVisible();
});
