import type { Page } from "@playwright/test";
import { STORY_BEATS } from "@/content/story";
import { IS_PROD_RUN, PROD_SMOKE_EMAIL, SB_SERVICE_KEY, SB_URL } from "./env";

export function uniqueEmail(tag = "e2e") {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

/**
 * Signs a (new) user in through the real /auth/callback route using an admin-generated link.
 * First-run setup is marked done unless `onboarded: false` (only the onboarding tests need it):
 * its card changes Today (e.g. the Night ritual isn't offered by itself while it shows).
 */
export async function signIn(
  page: Page,
  email = IS_PROD_RUN ? PROD_SMOKE_EMAIL : uniqueEmail(),
  { onboarded = true, tips = false, story = false }: { onboarded?: boolean; tips?: boolean; story?: boolean } = {},
) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!res.ok) throw new Error(`generate_link failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { id: string; hashed_token: string; verification_type: string };
  if (onboarded && body.id) {
    // Merge: the same jsonb remembers other first-run facts (locale_set: a 2nd device must not
    // push its own language over the account's, CJ-14).
    const headers = {
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      "Content-Type": "application/json",
    };
    const url = `${SB_URL}/rest/v1/profiles?user_id=eq.${body.id}`;
    const [prof] = (await (await fetch(`${url}&select=onboarding`, { headers })).json()) as {
      onboarding: Record<string, unknown> | null;
    }[];
    if (!prof?.onboarding?.done) {
      await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ onboarding: { ...prof?.onboarding, done: true } }),
      });
    }
  }
  // First-time tips are off unless a test is about them (they'd add bubbles to every screen).
  if (!tips && !IS_PROD_RUN && body.id) {
    await fetch(`${SB_URL}/rest/v1/profiles?user_id=eq.${body.id}`, {
      method: "PATCH",
      headers: {
        apikey: SB_SERVICE_KEY,
        Authorization: `Bearer ${SB_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tips_off: true }),
    });
  }
  // Story beats with Som are marked seen unless a test is about them (a cutscene would cover the
  // Farm). Also on prod: the shared smoke account opens the Farm.
  if (!story && body.id) {
    await fetch(`${SB_URL}/rest/v1/story_seen`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE_KEY,
        Authorization: `Bearer ${SB_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates",
      },
      body: JSON.stringify(STORY_BEATS.map((beat) => ({ user_id: body.id, beat, day: "2000-01-01" }))),
    });
  }
  if (IS_PROD_RUN) {
    // The shared smoke account must start each test in English (the app applies the account's language).
    const user = (await (
      await fetch(`${SB_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` },
      })
    ).json()) as { users?: { id: string; email: string }[] };
    const id = user.users?.find((u) => u.email === email)?.id;
    if (id) {
      await fetch(`${SB_URL}/rest/v1/profiles?user_id=eq.${id}`, {
        method: "PATCH",
        headers: {
          apikey: SB_SERVICE_KEY,
          Authorization: `Bearer ${SB_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: "en" }),
      });
    }
  }
  await page.goto(`/auth/callback?token_hash=${body.hashed_token}&type=${body.verification_type}`);
  await page.waitForURL("**/today");
  return email;
}

export async function setPrefs(
  page: Page,
  prefs: { locale?: "en" | "th"; theme?: "light" | "dark" | "system" },
) {
  // Seed once per tab; later reloads keep whatever the app (or the test) saved.
  await page.addInitScript((p) => {
    if (sessionStorage.getItem("247-prefs-seeded")) return;
    sessionStorage.setItem("247-prefs-seeded", "1");
    localStorage.setItem(
      "247-prefs",
      JSON.stringify({
        state: { locale: p.locale ?? "en", theme: p.theme ?? "light", soundOn: true, skipAnimations: true },
        version: 0,
      }),
    );
  }, prefs);
}
