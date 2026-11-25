import { loadEnvConfig } from "@next/env";

/**
 * Local runs: stop at once if the local database is behind the migrations (screens would fail
 * quietly and visual baselines would record error states). Prod smoke runs share one account:
 * create it once up front so parallel tests don't race.
 */
export default async function globalSetup() {
  loadEnvConfig(process.cwd());
  const { IS_PROD_RUN, PROD_SMOKE_EMAIL, SB_SERVICE_KEY, SB_URL } = await import("./helpers/env");
  if (!IS_PROD_RUN) {
    const { assertLocalDbCurrent } = await import("./helpers/localDb");
    assertLocalDbCurrent(SB_URL);
    return;
  }
  const res = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: PROD_SMOKE_EMAIL, email_confirm: true }),
  });
  if (!res.ok && res.status !== 422)
    throw new Error(`smoke user setup failed: ${res.status} ${await res.text()}`);
}
