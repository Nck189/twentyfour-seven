import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, setAllTemplates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** M7 seed capsule machine (QA_QC CJ-12): server-side tickets, pity, 0 → disabled, no double spend. */
test.skip(IS_PROD_RUN, "creates dedicated users");

async function setup(page: Page, tickets: number) {
  const email = uniqueEmail("gacha");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  await rest(`game_state?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ tickets }) });
  await page.goto("/farm");
  await page.getByRole("button", { name: /^Capsule machine/ }).click();
  return { id, sheet: page.getByRole("dialog", { name: "Capsule machine" }) };
}

const pulls = async (id: string) => (await rest(`gacha_pulls?user_id=eq.${id}&select=id`)) as unknown[];

test("CJ-12a 0 tickets: both pulls are disabled and the sheet says how to earn", async ({ page }) => {
  const { sheet } = await setup(page, 0);
  await expect(sheet.getByText("0 tickets", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Pull ×1", exact: true })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Pull ×10", exact: true })).toBeDisabled();
  await expect(sheet.getByText(/Earn tickets by waking on time/)).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
});

test("CJ-12b ×1 with a double-tap charges one ticket; Skip mid-shake keeps the result", async ({ page }) => {
  const { id, sheet } = await setup(page, 1);
  await expect(sheet.getByText("Rare+ in 10")).toBeVisible();
  await sheet.getByRole("button", { name: "Pull ×1", exact: true }).dblclick();
  const reveal = page.getByRole("dialog", { name: "Your capsules" });
  await reveal.getByRole("button", { name: "Skip" }).click();
  await expect(reveal.getByRole("button", { name: "Done" })).toBeVisible();
  // The shake's timers must not pull the reveal back into the crack (R-M7-1).
  await page.waitForTimeout(1500);
  await expect(reveal.getByRole("button", { name: "Done" })).toBeVisible();
  await expect(reveal.getByText(/New!|shard/).first()).toBeVisible();
  await expectNoSeriousA11y(page);
  await reveal.getByRole("button", { name: "Done" }).click();
  await expect(reveal).toHaveCount(0);

  expect(await pulls(id)).toHaveLength(1);
  const g = await gameState(id);
  expect(g.tickets).toBe(0);
  await expect(sheet.getByText("0 tickets", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Rare+ in 9")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Pull ×1", exact: true })).toBeDisabled();
});

test("CJ-12c ×10 costs 10 tickets, shows 10 capsules, and the pity counter follows the server", async ({
  page,
}) => {
  const { id, sheet } = await setup(page, 12);
  await expect(sheet.getByText("12 tickets", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Pull ×10", exact: true }).click();
  const reveal = page.getByRole("dialog", { name: "Your capsules" });
  await reveal.getByRole("button", { name: "Skip" }).click();
  await expect(reveal.getByRole("listitem")).toHaveCount(10);
  await reveal.getByRole("button", { name: "Done" }).click();

  expect(await pulls(id)).toHaveLength(10);
  const g = (await gameState(id)) as unknown as { tickets: number; pity: { since_rare: number } };
  expect(g.tickets).toBe(2);
  // 10 pulls always include a rare+ (pity), so the counter restarted inside this ×10.
  expect(g.pity.since_rare).toBeLessThan(10);
  await expect(sheet.getByText("2 tickets", { exact: true })).toBeVisible();
  await expect(sheet.getByText(`Rare+ in ${10 - g.pity.since_rare}`)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Pull ×10", exact: true })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Pull ×1", exact: true })).toBeEnabled();
});

test("CJ-12d Seed-dex shows found crops and silhouettes with completion", async ({ page }) => {
  const { sheet } = await setup(page, 1);
  await sheet.getByRole("button", { name: "Pull ×1", exact: true }).click();
  const reveal = page.getByRole("dialog", { name: "Your capsules" });
  await reveal.getByRole("button", { name: "Skip" }).click();
  await reveal.getByRole("button", { name: "Done" }).click();
  await sheet.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /^Seed-dex/ }).click();
  const dex = page.getByRole("dialog", { name: "Seed-dex" });
  await expect(dex.getByText(/^1 of 20 found · 5%$/)).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
});
