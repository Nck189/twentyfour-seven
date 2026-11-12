import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setAllTemplates, userIdFor } from "../helpers/db";
import { gotoToday, leaveAfterSignIn, wakeDay } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/** Story beats with Som (docs/STORY.md): a calm moment, skippable, once, recorded by the server. */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function setup(page: Page) {
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
