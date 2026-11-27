import { expect, it } from "vitest";
import { cleanName, NAME_MAX } from "@/lib/profile/name";

it("a display name is trimmed, single-spaced, free of control characters, at most 30 characters; blank is none", () => {
  expect(cleanName("  Minnie  ")).toBe("Minnie");
  expect(cleanName("Min\u0000nie\n  K.")).toBe("Minnie K.");
  expect(cleanName("   ")).toBeNull();
  expect(cleanName("มินนี่")).toBe("มินนี่"); // Thai marks stay with their letters
  expect(Array.from(cleanName("a".repeat(50))!)).toHaveLength(NAME_MAX);
});
