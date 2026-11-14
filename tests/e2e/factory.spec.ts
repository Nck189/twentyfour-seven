import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, userIdFor } from "../helpers/db";
import { leaveAfterSignIn } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/** M13 factory (SPEC §9): build → make → (time passes) → collect → numbers → sell. Server-owned. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("CJ-FAC-1 build the jam jar, make pickles, collect them, read the numbers and sell them", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("factory");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await rest(`game_state?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ coins: 600 }) });
  await rest("inventory", {
    method: "POST",
    body: JSON.stringify([
      { user_id: id, item_id: "crop:radish:normal:100", qty: 2 },
      { user_id: id, item_id: "crop:turnip:normal:100", qty: 2 },
    ]),
  });

  await page.goto("/farm");
  await page.getByRole("region", { name: "Factory" }).getByRole("button").click();
  const sheet = page.getByRole("dialog", { name: "Factory" });
  await expect(sheet.getByText("600 coins")).toBeVisible();
  await sheet.getByRole("button", { name: "Build the Jam jar for 150 coins" }).click();
  await expect(sheet.getByRole("status")).toContainText("Jam jar built!");
  await expect(sheet.getByText("450 coins")).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);

  // Make pickles (2 radish + 2 turnip); strawberry jam has no strawberries, so it can't start.
  await expect(sheet.getByRole("button", { name: "Make Strawberry jam" })).toBeDisabled();
  await sheet.getByRole("button", { name: "Make Pickles" }).click();
  await expect(sheet.getByRole("status")).toContainText("Pickles is on the machine.");
  await expect(sheet.getByText("On the machine 1/2")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Make Pickles" })).toBeDisabled(); // inputs used up
  expect((await gameState(id)).coins).toBe(450);

  // 25 minutes pass (the server's clock decides when it's ready).
  const jobs = (await rest(`production_jobs?user_id=eq.${id}&select=id,created_at,start_at,ready_at`)) as {
    id: string;
    created_at: string;
    start_at: string;
    ready_at: string;
  }[];
  const back = (iso: string) => new Date(new Date(iso).getTime() - 25 * 60_000).toISOString();
  for (const j of jobs)
    await rest(`production_jobs?id=eq.${j.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        created_at: back(j.created_at),
        start_at: back(j.start_at),
        ready_at: back(j.ready_at),
      }),
    });
  // The machine was built before the job started, so it moves back too.
  const [m] = (await rest(`machines?user_id=eq.${id}&select=bought_at`)) as { bought_at: string }[];
  await rest(`machines?user_id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ bought_at: back(m.bought_at) }),
  });
  await sheet.getByRole("button", { name: "Close" }).first().click();
  await page.getByRole("region", { name: "Factory" }).getByRole("button").click();
  await sheet.getByRole("button", { name: "Collect 1" }).click();
  await expect(sheet.getByRole("status")).toContainText("Collected 1");

  // The numbers: one machine, busy, so it's the bottleneck.
  await sheet.getByRole("button", { name: "Numbers" }).click();
  await expect(sheet.getByText("Made per day")).toBeVisible();
  await expect(sheet.getByText("Bottleneck: Jam jar")).toBeVisible();
  await expectNoSeriousA11y(page);

  // Sell the pickles at the market (34 coins).
  await sheet.getByRole("button", { name: "Close" }).first().click();
  const shop = page.getByRole("region", { name: "Shop" });
  await shop.getByRole("button", { name: "Sell 1 Pickles for 34 coins" }).click();
  await expect(shop.getByRole("status")).toContainText("+34 coins from the market");
  await expect.poll(async () => (await gameState(id)).coins).toBe(484);
});

test("CJ-FAC-2 a recipe that would use a gold crop asks first (G7 R-M13-2)", async ({ page }) => {
  test.setTimeout(60_000);
  const email = uniqueEmail("factory-gold");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await leaveAfterSignIn(page);
  const id = await userIdFor(email);
  await rest("machines", { method: "POST", body: JSON.stringify({ user_id: id, machine_id: "jam_jar" }) });
  await rest("inventory", {
    method: "POST",
    body: JSON.stringify([
      { user_id: id, item_id: "crop:radish:gold:150", qty: 2 },
      { user_id: id, item_id: "crop:turnip:normal:100", qty: 2 },
    ]),
  });
  await page.goto("/farm");
  await page.getByRole("region", { name: "Factory" }).getByRole("button").click();
  const sheet = page.getByRole("dialog", { name: "Factory" });
  await sheet.getByRole("button", { name: "Make Pickles" }).click();
  await expect(sheet.getByRole("alert")).toContainText("worth more sold on its own");
  expect(await rest(`production_jobs?user_id=eq.${id}&select=id`)).toEqual([]);
  await sheet.getByRole("button", { name: "Make Pickles anyway" }).click();
  await expect(sheet.getByRole("status")).toContainText("Pickles is on the machine.");
  await expect
    .poll(async () => ((await rest(`production_jobs?user_id=eq.${id}&select=id`)) as unknown[]).length)
    .toBe(1);
});
