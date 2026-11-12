import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { setAllTemplates, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** M11 calendar feed: More → Calendar gives a private link; the link serves the next two weeks. */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("CJ-ICS-1 get the calendar link and read the plan from it without signing in", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("ics");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  await setAllTemplates(await userIdFor(email), "07:00");
  await page.goto("/more");
  const card = page.locator("#calendar");
  await card.getByRole("button", { name: "Get my calendar link" }).click();
  const link = card.getByRole("textbox", { name: "Calendar" });
  await expect(link).toHaveValue(/\/ics\/[0-9a-f]{48}\.ics$/);
  await expect(card.getByRole("link", { name: "Add to Calendar" })).toHaveAttribute("href", /^webcal:/);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  const url = await link.inputValue();

  // No cookies: the secret link alone.
  const res = await request.get(url, { headers: { cookie: "" } });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const ics = await res.text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("SUMMARY:Focus");
  expect(ics).not.toContain("SUMMARY:Sleep");

  // A new link stops the old one.
  await card.getByRole("button", { name: "Make a new link" }).click();
  await expect(link).not.toHaveValue(url);
  expect((await request.get(url)).status()).toBe(404);
  expect((await request.get(url.replace(/[0-9a-f]{48}/, "nope"))).status()).toBe(404);
});
