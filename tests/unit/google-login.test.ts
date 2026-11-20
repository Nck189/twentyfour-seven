import { describe, expect, it } from "vitest";
import { googleLoginOffered } from "@/lib/auth/google";

const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
describe("Google sign-in is offered only when it can work (review fix B2)", () => {
  it("needs the switch", () => {
    expect(googleLoginOffered(undefined, SAFARI)).toBe(false);
    expect(googleLoginOffered("0", SAFARI)).toBe(false);
    expect(googleLoginOffered("1", SAFARI)).toBe(true);
  });
  it("is hidden inside LINE or Instagram, where Google refuses to sign people in", () => {
    expect(googleLoginOffered("1", `${SAFARI} Line/14.9.0`)).toBe(false);
    expect(googleLoginOffered("1", `${SAFARI} Instagram 330.0`)).toBe(false);
  });
});
