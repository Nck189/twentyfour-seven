import { describe, expect, it } from "vitest";
import { parseSignInInput } from "@/lib/auth/parseSignInInput";

describe("parseSignInInput", () => {
  it("accepts a 6-digit code, ignoring spaces", () => {
    expect(parseSignInInput(" 123 456 ")).toEqual({ kind: "code", code: "123456" });
  });

  it("accepts the default Supabase verify link (PKCE token)", () => {
    const link =
      "https://abc.supabase.co/auth/v1/verify?token=pkce_643b40&type=magiclink&redirect_to=https://twentyfour-seven.vercel.app/auth/callback";
    expect(parseSignInInput(link)).toEqual({ kind: "link", tokenHash: "pkce_643b40", type: "magiclink" });
  });

  it("accepts a signup-type link for first-time users", () => {
    expect(parseSignInInput("https://x.supabase.co/auth/v1/verify?token=pkce_1&type=signup")).toEqual({
      kind: "link",
      tokenHash: "pkce_1",
      type: "signup",
    });
  });

  it("accepts our callback link with token_hash", () => {
    expect(
      parseSignInInput("https://twentyfour-seven.vercel.app/auth/callback?token_hash=h1&type=email"),
    ).toEqual({
      kind: "link",
      tokenHash: "h1",
      type: "email",
    });
  });

  it("extracts the link from surrounding text and trailing punctuation", () => {
    expect(
      parseSignInInput("Sign in ( http://127.0.0.1:54321/auth/v1/verify?token=pkce_9&type=magiclink )"),
    ).toEqual({
      kind: "link",
      tokenHash: "pkce_9",
      type: "magiclink",
    });
  });

  it("defaults the type to magiclink when missing", () => {
    expect(parseSignInInput("https://x.co/verify?token=t")).toEqual({
      kind: "link",
      tokenHash: "t",
      type: "magiclink",
    });
  });

  it("rejects junk, short codes, links without a token, and unknown types", () => {
    expect(parseSignInInput("hello")).toEqual({ kind: "invalid" });
    expect(parseSignInInput("12345")).toEqual({ kind: "invalid" });
    expect(parseSignInInput("https://x.co/verify?type=magiclink")).toEqual({ kind: "invalid" });
    expect(parseSignInInput("https://x.co/verify?token=t&type=evil")).toEqual({ kind: "invalid" });
    expect(parseSignInInput("https://[bad")).toEqual({ kind: "invalid" });
  });
});
