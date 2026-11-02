import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockSetting } from "@/content/blocks";
import { addDays, DEFAULT_TZ, localDate } from "@/lib/time";
import type { DayContext, DayPlanRow, TemplateRow } from "./day";

export const DAY_PLAN_COLUMNS = "date, template_id, attending, bedtime_override, late_night, mode, overrides";

/** Loads the engine context (settings, templates, day plans from `fromOffset` to `toOffset` days around today). */
export async function loadDayContext(
  client: SupabaseClient,
  fromOffset = -2,
  toOffset = 3,
): Promise<{ ctx: DayContext; userId: string; today: string }> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("signed out");
  const [profile, settings, templates] = await Promise.all([
    client.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle(),
    client.from("settings").select("blocks, gym_close_time").eq("user_id", auth.user.id).single(),
    client.from("templates").select("*").order("sort"),
  ]);
  if (settings.error || templates.error) throw settings.error ?? templates.error;
  const timezone = (profile.data?.timezone as string | undefined) ?? DEFAULT_TZ;
  const today = localDate(new Date(), timezone);
  const plans = await client
    .from("day_plans")
    .select(DAY_PLAN_COLUMNS)
    .gte("date", addDays(today, fromOffset))
    .lte("date", addDays(today, toOffset));
  if (plans.error) throw plans.error;
  return {
    userId: auth.user.id,
    today,
    ctx: {
      timezone,
      blocks: settings.data.blocks as BlockSetting[],
      templates: templates.data as TemplateRow[],
      dayPlans: Object.fromEntries((plans.data as DayPlanRow[]).map((p) => [p.date, p])),
      gymClose: (settings.data.gym_close_time as string).slice(0, 5),
    },
  };
}

export function emptyDayPlan(date: string): DayPlanRow {
  return {
    date,
    template_id: null,
    attending: null,
    bedtime_override: null,
    late_night: null,
    mode: "normal",
    overrides: {},
  };
}
