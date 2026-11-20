import { describe, expect, it } from "vitest";
import { SITE_HOST, sitePath, siteUrl } from "@/content/site";

describe("the app's public address (review fix A1)", () => {
  it("has a host with no scheme or slash", () => {
    expect(SITE_HOST).toMatch(/^[a-z0-9.-]+$/);
  });
  it("builds links that say where they came from", () => {
    expect(sitePath("/", "share")).toBe("/?from=share");
    expect(siteUrl("/", "week")).toBe(`https://${SITE_HOST}/?from=week`);
    expect(siteUrl("/login")).toBe(`https://${SITE_HOST}/login`);
  });
});
