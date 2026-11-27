import { expect, test } from "@playwright/test";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** A name of your own (More → Account), so an invite says who it's from (docs/FRIENDS-DESIGN.md). */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("set my name in Account; my invite link then says it's from me", async ({ page, browser }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  const email = uniqueEmail("name");
  await signIn(page, email);
  const id = await userIdFor(email);

  // Without a name, the invite card asks for one.
  await page.goto("/more/sharing");
  const invite = page.locator("#invite");
  await expect(invite.getByRole("link", { name: "Add your name" })).toBeVisible();

  await page.goto("/more/account");
  const field = page.getByRole("textbox", { name: "Your name" });
  await field.fill("  Minnie  ");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Saved");
  await expect
    .poll(
      async () =>
        ((await rest(`profiles?user_id=eq.${id}&select=display_name`)) as { display_name: string }[])[0]!
          .display_name,
    )
    .toBe("Minnie");

  await page.goto("/more/sharing");
  await expect(invite.getByRole("link", { name: "Add your name" })).toHaveCount(0);
  await invite.getByRole("button", { name: "Get my invite link" }).click();
  const url = await invite.getByRole("textbox", { name: "Invite link" }).inputValue();

  const friend = await (await browser.newContext()).newPage();
  await setPrefs(friend, { locale: "en", theme: "light" });
  await friend.goto(new URL(url).pathname);
  await expect(friend.getByRole("heading", { name: "Minnie invited you to 24/7" })).toBeVisible();
});
