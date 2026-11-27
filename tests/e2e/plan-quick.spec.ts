import { expect, test } from "@playwright/test";
import { expectTouchTargets } from "../helpers/a11y";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { dayPlans, rest, setWakeMinutesAgo, userIdFor } from "../helpers/db";
import { IS_PROD_RUN } from "../helpers/env";
import { addDays, localDate, localParts } from "@/lib/time";

/** G (Minnie OK 2026-11-27): planning tomorrow in about 10 seconds; appointments in one line. */
test.skip(IS_PROD_RUN, "creates dedicated users");

type Plan = { date: string; overrides: { fixed_events?: { key: string; title: string; start: string }[] } };
const apptsOn = async (id: string, date: string) =>
  ((await dayPlans(id)) as Plan[])
    .filter((p) => p.date === date)
    .flatMap((p) => p.overrides.fixed_events ?? [])
    .filter((e) => e.key === "appointment")
    .map((e) => `${e.start} ${e.title}`);

test("G1 + G2: the ritual asks one question; a usual day is one tap; an appointment is one line", async ({
  page,
}) => {
  const email = uniqueEmail("g1");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  await setWakeMinutesAgo(id, 910); // Down Time: the ritual opens by itself
  const today = localDate(new Date(Date.now() - 910 * 60_000), "Asia/Bangkok");
  await page.goto("/today");
  const sheet = page.getByRole("dialog", { name: "Night ritual" });
  await sheet.getByRole("button", { name: "Next" }).click();
  await sheet.getByRole("button", { name: /Today went as usual/ }).click();
  await sheet.getByRole("button", { name: "Next" }).click();
  await expect(sheet.getByText(/Is tomorrow a usual day\?/)).toBeVisible();
  // The full editor waits folded.
  await expect(sheet.getByRole("button", { name: "15 min later" })).toBeHidden();
  await sheet.getByRole("button", { name: "Yes, a usual day" }).click();
  await expect(sheet.getByText("Usual plan it is. Nothing else to do.")).toBeVisible();
  const field = sheet.getByRole("textbox", { name: /Something on\?/ });
  await field.fill("2pm dentist");
  await expect(sheet.getByText(/14:00 · dentist/)).toBeVisible();
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet.getByText(/Added: dentist/)).toBeVisible();
  await expect.poll(() => apptsOn(id, addDays(today, 1))).toEqual(["14:00 dentist"]);
  await expectTouchTargets(page);
});

test("G4: the morning after no Night ritual, Today asks once what's different; Thai words work", async ({
  page,
}) => {
  const email = uniqueEmail("g4");
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, email);
  const id = await userIdFor(email);
  // Not the first day (the first day keeps to one thing).
  await rest(`profiles?user_id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }),
  });
  await setWakeMinutesAgo(id, 10);
  const today = localDate(new Date(Date.now() - 10 * 60_000), "Asia/Bangkok");
  test.skip(today !== localDate(new Date(), "Asia/Bangkok"), "a wake 10 min ago would land on yesterday");
  await page.goto("/today");
  await page.getByRole("button", { name: /I'm up — out of bed/ }).click();
  const card = page.getByRole("region", { name: "Anything different today?" });
  await expect(card).toBeVisible();
  await card.getByRole("textbox").fill("บ่าย 3 หมอฟัน");
  await expect(card.getByText(/15:00 · หมอฟัน/)).toBeVisible();
  await card.getByRole("button", { name: "Add", exact: true }).click();
  await expect(card.getByText(/Added: หมอฟัน/)).toBeVisible();
  // With no date written, a time already gone today means tomorrow (G7 G S3).
  const gone = localParts(new Date(), "Asia/Bangkok").hour >= 15;
  await expect.poll(() => apptsOn(id, gone ? addDays(today, 1) : today)).toEqual(["15:00 หมอฟัน"]);
  await card.getByRole("button", { name: "That's all" }).click();
  await expect(card).toBeHidden();
  await page.reload();
  await expect(page.getByRole("region", { name: "Anything different today?" })).toBeHidden();
});
