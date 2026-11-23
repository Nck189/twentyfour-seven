import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, settle, signIn, uniqueEmail } from "../helpers/auth";
import { rest, settingsBlocks, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";

/** Review fix D: More is four groups, each its own page with the same cards. */

const GROUPS = [
  { row: "Getting started", path: "/more/setup", cards: ["#setup-links", "#exercise"] },
  { row: "Sharing", path: "/more/sharing", cards: ["#share", "#calendar"] },
  {
    row: "Preferences",
    path: "/more/preferences",
    cards: ["#language", "#theme", "#sound", "#notifications", "#tips", "#cafe"],
  },
  { row: "Data & account", path: "/more/account", cards: ["#install", "#privacy", "#export", "#account"] },
] as const;

test.beforeEach(async ({ page }) => {
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, uniqueEmail("more"));
});

test("More shows four rows; each opens its page with its cards; back returns to More", async ({ page }) => {
  await page.goto("/more");
  await settle(page);
  const nav = page.getByRole("navigation", { name: "More" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  for (const g of GROUPS) {
    await nav.getByRole("link", { name: new RegExp(`^${g.row}`) }).click();
    await expect(page).toHaveURL(new RegExp(`${g.path}$`));
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(g.row);
    for (const c of g.cards) await expect(page.locator(c)).toBeVisible();
    await settle(page);
    await expectNoSeriousA11y(page);
    await expectTouchTargets(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Back to More" }).click();
    await expect(page).toHaveURL(/\/more$/);
  }
});

test("old /more#<card> links land on the card's page", async ({ page }) => {
  const old: [string, string][] = [
    ["language", "/more/preferences"],
    ["install", "/more/account"],
    ["exercise", "/more/setup"],
    ["notifications", "/more/preferences"],
    ["share", "/more/sharing"],
    ["calendar", "/more/sharing"],
    ["sound", "/more/preferences"],
    ["privacy", "/more/account"],
  ];
  for (const [id, path] of old) {
    await page.goto(`/more#${id}`);
    await expect(page).toHaveURL(new RegExp(`${path}#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
  // The setup card still lives on More itself; an unknown or broken anchor stays on More too.
  for (const hash of ["setup", "nope", "%"]) {
    await page.goto(`/more#${hash}`);
    await expect(page.getByRole("navigation", { name: "More" })).toBeVisible();
    await settle(page); // the redirect effect has run
    await expect(page).toHaveURL(new RegExp(`/more#${hash.replace("%", "%(25)?")}$`));
    if (hash === "setup") await expect(page.locator("#setup")).toBeInViewport();
  }
});

test("G7 D-1: a setup reward claimed on a group page says so there", async ({ page }) => {
  test.skip(IS_PROD_RUN, "writes settings directly");
  const email = uniqueEmail("more-reward");
  await signIn(page, email);
  const id = await userIdFor(email);
  // A first step for Focus, set elsewhere (another device): the step is done, not yet paid.
  const blocks = (await settingsBlocks(id)).map((b) =>
    b.key === "focus" ? { ...b, first10: "Open the notes" } : b,
  );
  await rest(`settings?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ blocks }) });
  await page.goto("/more/sharing");
  const notice = page.getByRole("status").filter({ hasText: "Setup reward" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("1 capsule ticket");
});
