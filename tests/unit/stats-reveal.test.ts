import { describe, expect, it } from "vitest";
import { accountOldEnough } from "@/lib/unlocks/useUnlocks";

/** R-M9-8: an older account keeps Stats even before today's settle has written its days. */
describe("accountOldEnough", () => {
  const now = new Date("2026-11-10T03:00:00Z");
  it("is true once the account is a day past the reveal", () => {
    expect(accountOldEnough("2026-11-06T02:59:00Z", now)).toBe(true);
    expect(accountOldEnough("2026-11-07T03:00:00Z", now)).toBe(false);
    expect(accountOldEnough(null, now)).toBe(false);
  });
});
