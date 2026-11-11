import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, setAllTemplates, userIdFor } from "../helpers/db";
import { wakeDay } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, zonedInstant } from "@/lib/time";

/** Playtest R1 R3: a return after days away is welcomed with one tap and a gift (server-side). */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("R3: back after 4 days away: Welcome back → Start today pays +1 ticket once; the 3-day goal shows", async ({
  page,
}) => {
  const email = uniqueEmail("wb");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setAllTemplates(id, "10:00");
  const today = wakeDay();
  const active = addDays(today, -5);
  await rest(`profiles?user_id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      created_at: zonedInstant(addDays(today, -20), 6 * 60, "Asia/Bangkok").toISOString(),
    }),
  });
  await rest("block_logs", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      date: active,
      block: "focus",
      planned_start: zonedInstant(active, 12 * 60, "Asia/Bangkok").toISOString(),
    }),
  });
  const before = (await gameState(id)).tickets;

  await page.goto("/today");
  const card = page.getByRole("region", { name: "Welcome back" });
  await expect(card).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await card.getByRole("button", { name: "Start today" }).click();
  await expect(page.getByText("+1 ticket, a welcome-back gift")).toBeVisible();
  await expect(page.getByRole("region", { name: "Back on track" })).toContainText("0 of 3 easy days");
  expect((await gameState(id)).tickets).toBe(before + 1);
  await page.reload();
  await expect(page.getByRole("region", { name: "Welcome back" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Back on track" })).toBeVisible();
});
