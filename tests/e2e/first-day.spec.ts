import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y, expectTouchTargets } from "../helpers/a11y";
import { setPrefs, settle, signIn, uniqueEmail } from "../helpers/auth";
import { gameState, rest, setChecklist, setWakeMinutesAgo, settingsBlocks, userIdFor } from "../helpers/db";
import { dismissNightOffer } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";
import { localDate } from "@/lib/time";

/** Review fix C1 (GROWTH G1): a new account's first day keeps to one thing to do. */
test.skip(IS_PROD_RUN, "creates dedicated users");
const crossesMidnight = (minutesAgo: number) =>
  localDate(new Date(Date.now() - minutesAgo * 60_000), "Asia/Bangkok") !==
  localDate(new Date(), "Asia/Bangkok");

async function account(page: import("@playwright/test").Page, newAccount: boolean) {
  const email = uniqueEmail(newAccount ? "first-day" : "day-two");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email, { newAccount });
  const id = await userIdFor(email);
  // Today's wake was 150 min ago: before this new account existed.
  await setWakeMinutesAgo(id, 150);
  await setChecklist(id, "work", ["Alpha"]);
  await page.goto("/today");
  await dismissNightOffer(page);
  return id;
}

test("signed up after today's wake: no 'I'm up' to press, tomorrow's instead; the rest waits folded", async ({
  page,
}) => {
  test.skip(crossesMidnight(150), "today's wake would be yesterday's date");
  await account(page, true);
  await expect(
    page.getByText(/^Tomorrow: tap “I'm up” the moment you leave the bed \(target \d\d:\d\d\)\.$/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /I'm up/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Current block" })).toBeVisible();
  // New words get one line (review fix C5).
  await expect(page.getByRole("region", { name: "Current block" })).toContainText(
    "Classes or work: the main part of the day.",
  );
  // Exercise and the whole day wait under one closed disclosure.
  await expect(page.getByRole("region", { name: "Exercise" })).toBeHidden();
  await page.getByText("Everything else today").click();
  await expect(page.getByRole("region", { name: "Exercise" })).toBeVisible();
  await expect(page.getByRole("button", { name: "See the whole day" })).toBeVisible();
  await expectNoSeriousA11y(page);
  await expectTouchTargets(page);
});

test("from the second day, Today is the everyday screen", async ({ page }) => {
  test.skip(crossesMidnight(150), "today's wake would be yesterday's date");
  await account(page, false);
  await expect(page.getByRole("button", { name: /I'm up/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Exercise" })).toBeVisible();
  await expect(page.getByText("Everything else today")).toHaveCount(0);
});

test("review C2: a block with no first step or checklist gets them right on Today; the setup rewards arrive once", async ({
  page,
}) => {
  test.skip(crossesMidnight(100), "today's wake would be yesterday's date");
  const email = uniqueEmail("in-place");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  // Focus is the current block (wake 60 min, then Focus 90): it has no built-in first step.
  await setWakeMinutesAgo(id, 100);
  const blocks = (await settingsBlocks(id)).map((b) =>
    b.key === "focus" ? { ...b, first10: null, checklist: [] } : b,
  );
  await rest(`settings?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ blocks }) });
  // The kinds of day can carry their own first step per block too: none here.
  await rest(`templates?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ blocks: {} }) });
  await page.goto("/today");
  await dismissNightOffer(page);
  await settle(page);
  const before = await gameState(id);
  const card = page.getByRole("region", { name: "Current block" });

  await card.getByRole("button", { name: "+ Pick a first step" }).click();
  const options = card.getByRole("radiogroup", { name: "+ Pick a first step" }).getByRole("radio");
  const first = (await options.first().innerText()).trim();
  await options.first().click();
  await expect(card.getByRole("checkbox", { name: first })).toBeVisible();

  await card.getByRole("textbox", { name: "Add a checklist item" }).fill("Open the laptop");
  await card.getByRole("button", { name: "Add", exact: true }).click();
  await expect(card.getByRole("checkbox", { name: "Open the laptop", exact: true })).toBeVisible();

  const focus = (await settingsBlocks(id)).find((b) => b.key === "focus") as {
    first10: string | null;
    checklist: { label: string }[];
  };
  expect(focus.first10).toBeTruthy();
  expect(focus.checklist.map((c) => c.label)).toEqual(["Open the laptop"]);
  // first10 pays 1 ticket, checklist 20 coins: once (server-checked).
  await expect.poll(async () => (await gameState(id)).tickets).toBe(before.tickets + 1);
  await expect.poll(async () => (await gameState(id)).coins).toBe(before.coins + 20);
  await page.reload();
  await settle(page);
  expect((await gameState(id)).tickets).toBe(before.tickets + 1);
  await expectTouchTargets(page);
});

test("G7 R-C-1: a card empty only for today never offers to set (and wipe) the block's default", async ({
  page,
}) => {
  test.skip(crossesMidnight(100), "today's wake would be yesterday's date");
  const email = uniqueEmail("keep-default");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 100); // Focus is current
  // Her own default: a first step and a two-item checklist for Focus.
  const blocks = (await settingsBlocks(id)).map((b) =>
    b.key === "focus"
      ? {
          ...b,
          first10: "Open the notes",
          checklist: [
            { id: "f-0", label: "One" },
            { id: "f-1", label: "Two" },
          ],
        }
      : b,
  );
  await rest(`settings?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ blocks }) });
  await rest(`templates?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ blocks: {} }) });
  // Today only: no first step, no checklist (as Plan's day editor would save it).
  await rest("day_plans?on_conflict=user_id,date", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: id,
      date: localDate(new Date(), "Asia/Bangkok"),
      overrides: { blocks: { focus: { first10: "", checklist: [] } } },
    }),
  });
  await page.goto("/today");
  await dismissNightOffer(page);
  const card = page.getByRole("region", { name: "Current block" });
  await expect(card).toContainText("Focus");
  // Today's override is what shows (empty), not the default; before the fix this offered the editors.
  await expect(card).toContainText("Set your first-10 action");
  await expect(card).not.toContainText("Open the notes");
  await expect(card).toContainText("No checklist");
  await expect(card.getByRole("button", { name: "+ Pick a first step" })).toHaveCount(0);
  await expect(card.getByRole("textbox", { name: "Add a checklist item" })).toHaveCount(0);
  const focus = (await settingsBlocks(id)).find((b) => b.key === "focus") as {
    first10: string;
    checklist: unknown[];
  };
  expect(focus.first10).toBe("Open the notes");
  expect(focus.checklist).toHaveLength(2);
});

test("G7 R-C-2: the farm strip doesn't push Today down when it arrives", async ({ page }) => {
  test.skip(crossesMidnight(10), "today's wake would be yesterday's date");
  await page.setViewportSize({ width: 390, height: 844 });
  const email = uniqueEmail("no-shift");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 10);
  await page.goto("/today");
  await dismissNightOffer(page);
  const up = page.getByRole("button", { name: /I'm up — out of bed/ });
  await expect(up).toBeVisible();
  const before = (await up.boundingBox())!.y;
  // The farm arrives about 2 s after Today's own data.
  await expect(page.getByRole("link", { name: "Your farm: open it" })).toBeVisible({ timeout: 15_000 });
  expect((await up.boundingBox())!.y).toBe(before);
});

test("G7 R-C-11: a real new account goes setup → All set → Done → the first-day Today", async ({ page }) => {
  test.skip(crossesMidnight(150), "today's wake would be yesterday's date");
  const email = uniqueEmail("first-journey");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email, { newAccount: true, onboarded: false });
  await page.goto("/welcome");
  await page.getByRole("button", { name: /Student/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Track all 7 blocks" }).click();
  await page.getByRole("button", { name: "Use all suggestions" }).click();
  await expect(page.getByText("All set")).toBeVisible();
  // The starter set its own wake time; put today's 150 min back so a block is current at any hour.
  await setWakeMinutesAgo(await userIdFor(email), 150);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await dismissNightOffer(page);
  // One thing to do: the current block; the rest (setup hint included) waits folded (R-C-10).
  await expect(page.getByRole("region", { name: "Current block" })).toBeVisible();
  await expect(page.getByText("Everything else today")).toBeVisible();
  await expect(page.getByRole("region", { name: "Exercise" })).toBeHidden();
  await expect(page.getByText("Set up 24/7", { exact: true })).toBeHidden();
});

test("G7 N-1: a built-in first step, set to None for today only, is never offered for overwrite", async ({
  page,
}) => {
  test.skip(crossesMidnight(150), "today's wake would be yesterday's date");
  const email = uniqueEmail("keep-builtin");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 150); // Work is current; its default is null (the built-in text)
  expect((await settingsBlocks(id)).find((b) => b.key === "work")).toMatchObject({ first10: null });
  await rest("day_plans?on_conflict=user_id,date", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: id,
      date: localDate(new Date(), "Asia/Bangkok"),
      overrides: { blocks: { work: { first10: "" } } },
    }),
  });
  await page.goto("/today");
  await dismissNightOffer(page);
  const card = page.getByRole("region", { name: "Current block" });
  await expect(card.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
  await expect(card).toContainText("Set your first-10 action");
  await expect(card.getByRole("button", { name: "+ Pick a first step" })).toHaveCount(0);
  expect((await settingsBlocks(id)).find((b) => b.key === "work")).toMatchObject({ first10: null });
});
