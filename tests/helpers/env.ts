/** Local Supabase by default; prod values when BASE_URL is set (npm run qc:prod). */
export const IS_PROD_RUN = Boolean(process.env.BASE_URL);
export const SB_URL = IS_PROD_RUN
  ? (process.env.PROD_SUPABASE_URL ?? "")
  : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
export const SB_SERVICE_KEY = IS_PROD_RUN
  ? (process.env.PROD_SUPABASE_SERVICE_ROLE_KEY ?? "")
  : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
/** Prod smoke runs reuse one dedicated test account instead of creating new users. */
export const PROD_SMOKE_EMAIL = "smoke-test@twentyfour-seven.invalid";
