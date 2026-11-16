import { describe, expect, it } from "vitest";
import { EXPORT_TABLES } from "@/lib/export/tables";
import { admin, anon, newUser } from "./helpers";

/** M14 / G15: "delete my account" removes the user and every row they own (Minnie OK 2026-11-16). */
describe("delete my account", () => {
  it("removes the auth user and all their rows; others are untouched; needs a session", async () => {
    const u = await newUser("del-me");
    const other = await newUser("del-other");
    // Some data in a few places.
    await u.client.from("backlog_items").insert({ user_id: u.id, title: "Thesis" });
    await other.client.from("backlog_items").insert({ user_id: other.id, title: "Keep me" });
    await u.client.from("events").insert({ user_id: u.id, type: "app_opened", payload: {} });
    expect((await anon().rpc("delete_my_account")).error).not.toBeNull();

    const r = await u.client.rpc("delete_my_account");
    expect(r.error).toBeNull();
    expect((await admin().auth.admin.getUserById(u.id)).data.user).toBeNull();
    for (const table of EXPORT_TABLES) {
      const rows = await admin().from(table).select("user_id").eq("user_id", u.id);
      expect(rows.error, table).toBeNull();
      expect(rows.data, table).toEqual([]);
    }
    expect((await admin().from("backlog_items").select("title").eq("user_id", other.id)).data).toEqual([
      { title: "Keep me" },
    ]);
  });
});
