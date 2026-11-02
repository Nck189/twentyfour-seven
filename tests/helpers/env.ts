/** Local Supabase defaults (supabase start). Overridable for CI. */
export const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
export const IS_PROD_RUN = Boolean(process.env.BASE_URL);
