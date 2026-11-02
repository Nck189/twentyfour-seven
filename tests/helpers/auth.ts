import type { Page } from "@playwright/test";
import { IS_PROD_RUN, PROD_SMOKE_EMAIL, SB_SERVICE_KEY, SB_URL } from "./env";

export function uniqueEmail(tag = "e2e") {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

/** Signs a (new) user in through the real /auth/callback route using an admin-generated link. */
export async function signIn(page: Page, email = IS_PROD_RUN ? PROD_SMOKE_EMAIL : uniqueEmail()) {
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
  const body = (await res.json()) as { hashed_token: string; verification_type: string };
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
