import { expect, test } from "@playwright/test";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/**
 * iPad/Mac: with the farm in the main column, the side panel is Plan with the backlog (it was an
 * M0 "coming soon" placeholder until 2026-11-24). G7 TS S2-1..3: dated tasks, opening a task and
 * coins next to the farm's Shop.
 */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("beside the farm: plan a dated task, open it, finish one, and the farm's coins follow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setPrefs(page, { locale: "en", theme: "light" });
  const email = uniqueEmail("side");
  await signIn(page, email);
  const id = await userIdFor(email);
  await rest("backlog_items", {
    method: "POST",
    body: JSON.stringify({ user_id: id, title: "Water the plants" }),
  });
  await page.goto("/farm");
  const panel = page.getByRole("complementary");
  await expect(panel.getByRole("heading", { name: "Plan", level: 2 })).toBeVisible();
  await expect(panel).not.toContainText("coming soon");

  // A dated capture stays visible in the panel (in its day), not just saved somewhere (S2-1).
  const capture = panel.getByRole("textbox").first();
  await capture.fill("Report 30m tomorrow");
  await capture.press("Enter");
  // As on the Plan tab: it's in tomorrow's card.
  await panel.getByRole("button", { name: "Tomorrow" }).click();
  await expect(
    panel.getByRole("region", { name: "Tomorrow" }).getByText("Report", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Today" }).first().click();

  // Opening a task opens its sheet right there (S2-2).
  await panel.getByRole("button", { name: "Edit Water the plants" }).click();
  const sheet = page.getByRole("dialog", { name: "Water the plants" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");

  // Finishing it pays coins, and the farm's Shop next to it shows the new balance (S2-3).
  const before = (await gameState(id)).coins;
  await panel.getByRole("button", { name: "Finish Water the plants" }).click();
  await expect.poll(async () => (await gameState(id)).coins).toBeGreaterThan(before);
  const after = (await gameState(id)).coins;
  await expect(page.getByRole("main").getByText(`${after} coins`).first()).toBeAttached();
});
