import { expect, test } from "@playwright/test";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/**
 * Invites (docs/FRIENDS-DESIGN.md). The invite-only switch is global, so these tests never turn
 * it on (other tests run alongside); the gate's screen is driven by stubbing `my_access` only, and
 * the switch itself is covered by tests/integration/invites.test.ts.
 */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("a friend joins through my invite link; after their first lived day we both get a ticket", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  await setPrefs(host, { locale: "en", theme: "light" });
  const hostEmail = uniqueEmail("inv-host");
  await signIn(host, hostEmail);
  const hostId = await userIdFor(hostEmail);
  await rest(`profiles?user_id=eq.${hostId}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: "Minnie" }),
  });
  await host.goto("/more/sharing");
  const card = host.locator("#invite");
  await card.getByRole("button", { name: "Get my invite link" }).click();
  const url = await card.getByRole("textbox", { name: "Invite link" }).inputValue();
  expect(url).toMatch(/\/i\/[0-9a-f]{48}$/);
  await expect(card).toContainText("2 invites left");

  // The friend opens the link signed out, then signs up: the account joins through it.
  const friendCtx = await browser.newContext();
  const friend = await friendCtx.newPage();
  await setPrefs(friend, { locale: "en", theme: "light" });
  await friend.goto(new URL(url).pathname);
  await expect(friend.getByRole("heading", { name: "Minnie invited you to 24/7" })).toBeVisible();
  const friendEmail = uniqueEmail("inv-friend");
  await signIn(friend, friendEmail);
  const friendId = await userIdFor(friendEmail);
  await expect
    .poll(async () => ((await rest(`invites?user_id=eq.${friendId}&select=inviter_id`)) as unknown[]).length)
    .toBe(1);

  // The friend's first lived minimum day pays both, once.
  const [h0, f0] = [(await gameState(hostId)).tickets, (await gameState(friendId)).tickets];
  await rest("block_logs", {
    method: "POST",
    body: JSON.stringify({ user_id: friendId, date: "2026-11-22", block: "wake" }),
  });
  await rest("day_results", {
    method: "POST",
    body: JSON.stringify({ user_id: friendId, date: "2026-11-22", kind: "minimum" }),
  });
  expect([(await gameState(hostId)).tickets, (await gameState(friendId)).tickets]).toEqual([
    h0! + 1,
    f0! + 1,
  ]);
  await host.reload();
  await expect(host.locator("#invite")).toContainText("1 invite left");
  await expect(host.locator("#invite")).toContainText("first day done");
  await hostCtx.close();
  await friendCtx.close();
});

test("invite-only: without an invite the app asks for one; pasting a link lets you in", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  await setPrefs(host, { locale: "en", theme: "light" });
  await signIn(host, uniqueEmail("inv-gate-host"));
  await host.goto("/more/sharing");
  await host.locator("#invite").getByRole("button", { name: "Get my invite link" }).click();
  const url = await host.locator("#invite").getByRole("textbox", { name: "Invite link" }).inputValue();

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await setPrefs(page, { locale: "en", theme: "light" });
  // The switch is on and this account wasn't invited: until it claims one, the server says no.
  let claimed = false;
  await page.route(/\/rest\/v1\/rpc\/claim_invite/, async (route) => {
    const r = await route.fetch();
    if (r.ok()) claimed = true;
    await route.fulfill({ response: r });
  });
  await page.route(/\/rest\/v1\/rpc\/my_access/, (route) =>
    claimed
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: '{"invite_only":true,"allowed":false}',
        }),
  );
  await signIn(page, uniqueEmail("inv-gated"), { newAccount: true });
  await expect(page.getByRole("heading", { name: "24/7 is invite-only for now" })).toBeVisible();
  await page.getByRole("textbox", { name: "Invite link" }).fill("not a link");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("doesn't look like an invite link");
  await page.getByRole("textbox", { name: "Invite link" }).fill(url);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("heading", { name: "24/7 is invite-only for now" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).first()).toBeVisible();
  await hostCtx.close();
  await ctx.close();
});
