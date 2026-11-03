import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { DEFAULT_TEMPLATES } from "@/content/defaults";
import { EXPORT_TABLES } from "@/lib/export/tables";
import { anon, newUser } from "./helpers";

let A: { client: SupabaseClient; id: string };
let B: { client: SupabaseClient; id: string };

beforeAll(async () => {
  A = await newUser("rls-a");
  B = await newUser("rls-b");
  // Give B some rows in user-writable tables.
  await B.client.from("backlog_items").insert({ user_id: B.id, title: "B secret task" });
  await B.client.from("events").insert({ user_id: B.id, type: "test", payload: { secret: true } });
  await B.client.rpc("log_exercise", { p_type: "gym", p_minutes: 30, p_key: "rls-b-workout-1" });
});

describe("CJ-02 first login seeds Minnie's defaults", () => {
  it("profile, settings (7 blocks, goal 3, gym 22:00, tags), 6 templates, game_state, 7 plots", async () => {
    const c = A.client;
    const { data: profile } = await c.from("profiles").select("*").single();
    expect(profile).toMatchObject({ user_id: A.id, timezone: "Asia/Bangkok", locale: "en" });

    const { data: settings } = await c.from("settings").select("*").single();
    expect(settings!.blocks).toEqual(DEFAULT_BLOCKS);
    expect(settings).toMatchObject({
      weekly_exercise_goal: 3,
      gym_close_time: "22:00:00",
      wake_window_min: 15,
    });
    expect((settings!.tags as { key: string }[]).map((t) => t.key)).toEqual([
      "yop",
      "senior_project",
      "class",
      "personal",
      "family",
      "health",
    ]);

    const { data: templates } = await c
      .from("templates")
      .select("key, target_wake, weekdays, fixed_events")
      .order("sort");
    expect(templates!.map((t) => t.key)).toEqual(DEFAULT_TEMPLATES.map((t) => t.key));
    expect(templates!.find((t) => t.key === "class_wed")!.target_wake).toBe("07:30:00");

    const { data: game } = await c.from("game_state").select("coins, tickets, streak").single();
    expect(game).toEqual({ coins: 0, tickets: 0, streak: 0 });

    const { data: plots } = await c.from("plots").select("slot");
    expect(plots!.map((p) => p.slot).sort()).toEqual([...DEFAULT_BLOCKS.map((b) => b.key)].sort());
  });
});

describe("G5 RLS: user A cannot touch user B", () => {
  it.each(EXPORT_TABLES)("A sees no B rows in %s", async (table) => {
    const { data, error } = await A.client.from(table).select("*").eq("user_id", B.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("A sees only their own rows overall", async () => {
    for (const table of EXPORT_TABLES) {
      const { data } = await A.client.from(table).select("user_id");
      for (const row of data ?? []) expect(row.user_id).toBe(A.id);
    }
  });

  it("A cannot insert rows owned by B", async () => {
    const { error } = await A.client.from("backlog_items").insert({ user_id: B.id, title: "spoof" });
    expect(error?.code).toBe("42501");
    const { error: e2 } = await A.client.from("events").insert({ user_id: B.id, type: "spoof" });
    expect(e2?.code).toBe("42501");
  });

  it("A cannot update or delete B's rows", async () => {
    const { data: upd } = await A.client
      .from("backlog_items")
      .update({ title: "hacked" })
      .eq("user_id", B.id)
      .select();
    expect(upd).toEqual([]);
    const { data: del } = await A.client.from("backlog_items").delete().eq("user_id", B.id).select();
    expect(del).toEqual([]);
    const { data: still } = await B.client.from("backlog_items").select("title");
    expect(still!.map((r) => r.title)).toContain("B secret task");
  });

  it("A cannot move a row to B (with check)", async () => {
    const { data: mine } = await A.client
      .from("backlog_items")
      .insert({ user_id: A.id, title: "mine" })
      .select()
      .single();
    const { error } = await A.client.from("backlog_items").update({ user_id: B.id }).eq("id", mine!.id);
    expect(error?.code).toBe("42501");
  });
});

describe("G5 economy is read-only for clients (changes only via RPC)", () => {
  it("game_state cannot be updated or inserted directly", async () => {
    const { data } = await A.client
      .from("game_state")
      .update({ coins: 999999, tickets: 999 })
      .eq("user_id", A.id)
      .select();
    expect(data ?? []).toEqual([]);
    const { data: g } = await A.client.from("game_state").select("coins, tickets").single();
    expect(g).toEqual({ coins: 0, tickets: 0 });
  });

  it.each(["inventory", "seed_dex", "gacha_pulls", "animals"])("%s rejects direct inserts", async (table) => {
    const row: Record<string, unknown> = { user_id: A.id };
    if (table === "inventory") Object.assign(row, { item_id: "x", qty: 99 });
    if (table === "seed_dex") Object.assign(row, { crop_id: "star_fruit" });
    if (table === "gacha_pulls")
      Object.assign(row, { banner: "b", result: "star_fruit", rarity: "legendary", pity_before: {} });
    if (table === "animals") Object.assign(row, { species: "red_panda" });
    const { error } = await A.client.from(table).insert(row);
    expect(error?.code).toBe("42501");
  });

  it("decor: can move (x, y) but not change the item", async () => {
    const { error } = await A.client.from("decor").insert({ user_id: A.id, item_id: "pond" });
    expect(error?.code).toBe("42501");
  });

  it("events are append-only (no update/delete)", async () => {
    await A.client.from("events").insert({ user_id: A.id, type: "t1" });
    const { data: upd } = await A.client
      .from("events")
      .update({ type: "changed" })
      .eq("user_id", A.id)
      .select();
    expect(upd ?? []).toEqual([]);
    const { data: del } = await A.client.from("events").delete().eq("user_id", A.id).select();
    expect(del ?? []).toEqual([]);
    const { data } = await A.client.from("events").select("type").eq("type", "t1");
    expect(data).toHaveLength(1);
  });

  it("users cannot call the seed function directly", async () => {
    const { error } = await A.client.rpc("seed_user_defaults", { uid: B.id });
    expect(error).not.toBeNull();
  });
});

describe("anonymous access", () => {
  it.each(EXPORT_TABLES)("anon reads nothing from %s", async (table) => {
    const { data, error } = await anon().from(table).select("*");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("keepalive RPC works for anon (cron)", async () => {
    const { data, error } = await anon().rpc("keepalive");
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
  });
});
