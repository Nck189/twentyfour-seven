import { describe, expect, it } from "vitest";
import { callbackFailure } from "@/lib/auth/callback";

const q = (s: string) => new URLSearchParams(s);
describe("why a sign-in didn't finish (G7 R-B-6)", () => {
  it("a cancelled Google sign-in is 'cancelled', not an expired link", () => {
    expect(callbackFailure(q("error=access_denied&error_description=The+user+denied+access"))).toBe(
      "cancelled",
    );
  });
  it("any other provider error is 'provider'", () => {
    expect(callbackFailure(q("error=server_error&error_description=Unable+to+exchange+external+code"))).toBe(
      "provider",
    );
  });
  it("a bad or used email link stays 'link'", () => {
    expect(callbackFailure(q("token_hash=abc&type=magiclink"))).toBe("link");
    expect(callbackFailure(q(""))).toBe("link");
  });
});
