import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setAllTemplates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** M8 exercise + animals (QA_QC CJ-13): a workout feeds the animals; the 3rd hatches an egg. */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function setup(page: Page) {
  const email = uniqueEmail("animals");
  // setPrefs also turns on "skip animations": the hatch shows its result at once.
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  return id;
}

async function logWorkout(page: Page, minutes = 30) {
  await page.getByRole("button", { name: "Log a workout" }).click();
  const sheet = page.getByRole("dialog", { name: "Log a workout" });
  await sheet.getByRole("radio", { name: "Gym" }).click();
  await sheet.getByRole("radio", { name: `${minutes} min` }).click();
  await sheet.getByRole("button", { name: "Log it" }).click();
  return sheet;
}

test("CJ-13 three workouts: the ring fills, the 3rd hatches an egg (with its reveal), animals are fed", async ({
  page,
}) => {
  const id = await setup(page);
  // Two counted workouts 25 h ago (2 per rolling 24 h count), straight in the table like past check-ins.
  const yesterday = new Date(Date.now() - 25 * 3_600_000).toISOString();
  await rest("exercise_logs", {
    method: "POST",
    body: JSON.stringify([
      { user_id: id, at: yesterday, type: "run", minutes: 30, counted: true },
      { user_id: id, at: yesterday, type: "walk", minutes: 30, counted: true },
    ]),
  });
  await rest(`game_state?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ egg_progress: 2 }) });

  await page.goto("/today");
  await expect(page.getByRole("region", { name: "Exercise" })).toBeVisible();
  const sheet = await logWorkout(page);
  const hatch = page.getByRole("dialog", { name: "It hatched!" });
  // The live region announces it (one element; the big visible line repeats it).
  await expect(hatch.getByRole("status")).toContainText(/^Meet your /);
  await expectNoSeriousA11y(page);
  await hatch.getByRole("button", { name: "Done" }).click();
  await expect(hatch).toHaveCount(0);
  await expect(sheet.getByRole("status")).toContainText("fed for 2 more days");

  const animals = (await rest(`animals?user_id=eq.${id}&select=species,fed_until`)) as {
    species: string;
    fed_until: string;
  }[];
  expect(animals).toHaveLength(1);
  expect(Date.parse(animals[0]!.fed_until) - Date.now()).toBeGreaterThan(47 * 3_600_000);
  const [gs] = (await rest(`game_state?user_id=eq.${id}&select=egg_progress`)) as { egg_progress: number }[];
  expect(gs!.egg_progress).toBe(0);

  // The farm shows it in the pen, fed; the egg starts over.
  await page.goto("/farm");
  const pen = page.getByRole("region", { name: "Animals" });
  await expect(pen.getByText("0 of 3 workouts")).toBeVisible();
  await expect(pen.getByRole("button", { name: /: fed$/ })).toHaveCount(1);
  await expectTouchTargets(page);
});

test("CJ-13b a hungry animal sleeps (never dies); a workout feeds it; petting counts 3 a day", async ({
  page,
}) => {
  const id = await setup(page);
  await rest("animals", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      species: "cow",
      fed_until: new Date(Date.now() - 3_600_000).toISOString(),
    }),
  });
  await page.goto("/farm");
  const pen = page.getByRole("region", { name: "Animals" });
  await pen.getByRole("button", { name: "Cow: sleepy" }).click();
  const sheet = page.getByRole("dialog", { name: "Cow" });
  await expect(sheet.getByText(/Sleepy and hungry/)).toBeVisible();
  for (let i = 0; i < 4; i++) await sheet.getByRole("button", { name: "Pet" }).click();
  await expect(sheet.getByRole("status")).toContainText("Pets count 3 times every 24 hours");
  const [cow] = (await rest(`animals?user_id=eq.${id}&select=love`)) as { love: number }[];
  expect(cow!.love).toBe(3);
  await expectNoSeriousA11y(page);
  await sheet.getByRole("button", { name: "Close" }).click();

  await page.goto("/today");
  const log = await logWorkout(page, 20);
  // Wait for the server's answer before leaving the page (R-M8-3).
  await expect(log.getByRole("status")).toContainText("fed for 2 more days");
  await page.goto("/farm");
  await expect(page.getByRole("button", { name: "Cow: fed" })).toBeVisible();
});

test("CJ-13c a 3rd workout on the same day is logged but doesn't feed again (2 a day count)", async ({
  page,
}) => {
  const id = await setup(page);
  const earlier = new Date(Date.now() - 60_000).toISOString();
  await rest("exercise_logs", {
    method: "POST",
    body: JSON.stringify([
      { user_id: id, at: earlier, type: "run", minutes: 30, counted: true },
      { user_id: id, at: earlier, type: "walk", minutes: 30, counted: true },
    ]),
  });
  await page.goto("/today");
  const sheet = await logWorkout(page, 20);
  await expect(sheet.getByRole("status")).toContainText("already counted twice");
  const logs = (await rest(`exercise_logs?user_id=eq.${id}&select=counted&order=at`)) as {
    counted: boolean;
  }[];
  expect(logs.map((l) => l.counted)).toEqual([true, true, false]);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("region", { name: "Exercise" }).getByText("3 of 3 this week")).toBeVisible();
});
