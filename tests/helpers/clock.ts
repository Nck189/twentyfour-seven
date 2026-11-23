import type { Page } from "@playwright/test";

/**
 * Fixed clock for deterministic tests (Asia/Bangkok). Kept in the past relative to real time
 * so Supabase JWTs (issued at real time) never look expired to the client.
 * 2026-10-28 is a Wednesday (class day).
 */
export const FIXED_NOW = new Date("2026-10-28T10:00:00+07:00");

/**
 * A calm afternoon on the same day (14:00, past the wake window, before Down Time) for tests whose
 * flow must not meet the evening's Night ritual offer or Som's wait during Down Time.
 */
export const CALM_AFTERNOON = new Date("2026-10-28T14:00:00+07:00");

export async function fixClock(page: Page, at: Date = FIXED_NOW) {
  await page.clock.setFixedTime(at);
}
