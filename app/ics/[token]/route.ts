import { createClient } from "@supabase/supabase-js";
import type { BlockSetting } from "@/content/blocks";
import { buildIcs, type IcsEvent } from "@/lib/ics/ics";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { addDays } from "@/lib/time";
import { timelineFor, type DayContext, type DayPlanRow, type TemplateRow } from "@/lib/today/day";
import en from "@/messages/en.json";
import th from "@/messages/th.json";

/**
 * The calendar feed (M11, SPEC §9): `/ics/<secret>` (optionally `.ics`). No login: the secret link
 * is checked by the `ics_context` RPC, which returns only what the engine needs. The next 14 days of
 * planned blocks (not Sleep) and fixed events, in UTC. An unknown link is a plain 404.
 */
const DAYS = 14;

type Ctx = {
  timezone: string;
  locale: "en" | "th";
  settings: { blocks: BlockSetting[]; gym_close_time: string } | null;
  templates: TemplateRow[];
  day_plans: DayPlanRow[];
};

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("Not found", { status: 404 });
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("ics_context", { p_token: token });
  if (error) return new Response("Unavailable", { status: 503 });
  const c = data as Ctx | null;
  if (!c || !c.settings) return new Response("Not found", { status: 404 });

  // A malformed saved plan never surfaces as a bare 500 on a public URL (G7 R2-4).
  try {
    return feed({ ...c, settings: c.settings });
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
}

function feed(c: Ctx & { settings: NonNullable<Ctx["settings"]> }): Response {
  const ctx: DayContext = {
    timezone: c.timezone,
    blocks: c.settings.blocks,
    templates: c.templates,
    dayPlans: Object.fromEntries(c.day_plans.map((p) => [p.date, p])),
    gymClose: c.settings.gym_close_time.slice(0, 5),
  };
  const msg = c.locale === "th" ? th : en;
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: c.timezone }).format(now);
  const events: IcsEvent[] = [];
  for (let i = 0; i < DAYS; i++) {
    const date = addDays(today, i);
    const tl = timelineFor(ctx, date);
    for (const b of tl.blocks) {
      if (b.key === "sleep" || b.end <= now) continue;
      events.push({
        uid: `${date}-${b.key}@247`,
        start: b.start,
        end: b.end,
        summary: msg.blocks.name[b.key],
        description: b.first10 ?? undefined,
      });
    }
    for (const e of tl.fixedEvents) {
      if (e.end <= now) continue;
      const label = e.title ?? (msg.fixedEvents as Record<string, string>)[e.key] ?? e.key;
      events.push({ uid: `${date}-fixed-${e.id}@247`, start: e.start, end: e.end, summary: label });
    }
  }
  const body = buildIcs(events, { name: msg.push.icsName, now });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="24-7.ics"',
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
