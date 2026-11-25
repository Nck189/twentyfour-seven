import { expect, it } from "vitest";
import { tokenFrom } from "@/lib/invite/token";

const T = "ab".repeat(24);

it("reads the invite token from a pasted link, a bare token, or text around it", () => {
  expect(tokenFrom(`https://twentyfour-seven.vercel.app/i/${T}`)).toBe(T);
  expect(tokenFrom(`  ${T.toUpperCase()} `)).toBe(T);
  expect(tokenFrom(`join me! https://x.app/i/${T}?from=line`)).toBe(T);
  expect(tokenFrom("https://x.app/i/abc")).toBeNull();
  expect(tokenFrom("")).toBeNull();
});
