import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { rest, setAllTemplates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** M12 share availability + booking (SPEC §9): link → free times (no login) → request → accept. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("CJ-SHARE-1 a friend asks for a free time through the link; the owner accepts it into the plan", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("share");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setAllTemplates(id, "07:00");
  await page.goto("/more");
  const card = page.locator("#share");
  await card.getByRole("button", { name: "Get my link" }).click();
  const link = card.getByRole("textbox", { name: "Share link" });
  await expect(link).toHaveValue(/\/share\/[0-9a-f]{48}$/);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  const url = await link.inputValue();

  // A friend, not signed in, on a phone.
  const friendCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const friend = await friendCtx.newPage();
  await friend.goto(url);
  await expect(friend.getByRole("heading", { level: 1 })).toContainText(/free times/i);
  const slots = friend.getByRole("button", { name: /^Ask for \d\d:\d\d–\d\d:\d\d$/ });
  await expect(slots.first()).toBeVisible();
  // Free/busy only: no block names or plans on the page.
  for (const word of ["Work", "Focus", "Sleep", "Gradation"])
    await expect(friend.locator("main")).not.toContainText(word);
  await expectNoHorizontalScroll(friend);
  await expectTouchTargets(friend);
  await slots.first().click();
  await friend.getByLabel("Your name").fill("Ploy");
  await friend.getByLabel("A short note (optional)").fill("Coffee and notes?");
  await friend.getByRole("button", { name: "Send request" }).click();
  await expect(friend.getByRole("status")).toContainText("Sent!");
  await friendCtx.close();

  // The owner answers in More.
  await page.reload();
  const inbox = page.locator("#share");
  await expect(inbox.getByText(/^Ploy · /)).toBeVisible();
  await expect(inbox.getByText("Coffee and notes?")).toBeVisible();
  await inbox.getByRole("button", { name: "Accept" }).click();
  await expect(inbox.getByRole("status")).toContainText("Accepted Ploy's request");
  await expect
    .poll(async () => {
      const plans = (await rest(`day_plans?user_id=eq.${id}&select=overrides`)) as {
        overrides: { fixed_events?: { title: string }[] };
      }[];
      return plans.flatMap((p) => p.overrides.fixed_events ?? []).map((e) => e.title);
    })
    .toContain("Ploy");
});

test("CJ-SHARE-2 an unknown link shows not-found and is never indexed", async ({ page }) => {
  // The page streams (Suspense + connection()), so notFound() after the shell is a 200 with a
  // noindex robots tag rather than a 404 status (DECISIONS M12); what matters is nothing leaks.
  await setPrefs(page, { locale: "en", theme: "light" });
  await page.goto(`/share/${"0".repeat(48)}`);
  await expect(page.getByText(/couldn.t find|not found/i).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("button", { name: /^Ask for / })).toHaveCount(0);
});
