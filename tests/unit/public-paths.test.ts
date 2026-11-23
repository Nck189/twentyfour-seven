import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/supabase/proxy-session";

describe("paths reachable without an account (review fix B1)", () => {
  it("the front door is public as an exact match only", () => {
    expect(isPublicPath("/")).toBe(true);
    for (const p of ["/today", "/plan", "/farm", "/stats", "/more", "/welcome", "/admin/retention"])
      expect(isPublicPath(p), p).toBe(false);
  });
  it("the existing public paths still are", () => {
    for (const p of ["/login", "/auth/callback", "/share/abc", "/ics/abc", "/offline.html"])
      expect(isPublicPath(p), p).toBe(true);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});
