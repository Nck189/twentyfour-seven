import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, settle, signIn, uniqueEmail } from "../helpers/auth";

/** Review fix D: More is four groups, each its own page with the same cards. */

const GROUPS = [
  { row: "Setup", path: "/more/setup", cards: ["#setup-links", "#exercise"] },
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
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  // The setup card still lives on More itself.
  await page.goto("/more#nope");
  await expect(page).toHaveURL(/\/more#nope$/);
  await expect(page.getByRole("navigation", { name: "More" })).toBeVisible();
});
