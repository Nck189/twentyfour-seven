import type { EmailOtpType } from "@supabase/supabase-js";

export type SignInInput =
  | { kind: "code"; code: string }
  | { kind: "link"; tokenHash: string; type: EmailOtpType }
  | { kind: "invalid" };

const LINK_TYPES: EmailOtpType[] = ["magiclink", "signup", "email", "invite", "recovery", "email_change"];

/**
 * Accepts what a user pastes into the login box: a 6–10 digit code, or the sign-in link copied
 * from the email (Supabase `/auth/v1/verify?token=…&type=…` or our `/auth/callback?token_hash=…`).
 * Lets the iOS home-screen app sign in without opening the link in Safari.
 */
export function parseSignInInput(raw: string): SignInInput {
  const text = raw.trim();
  const digits = text.replace(/\s/g, "");
  if (/^\d{6,10}$/.test(digits)) return { kind: "code", code: digits };

  const urlMatch = text.match(/https?:\/\/\S+/);
  if (!urlMatch) return { kind: "invalid" };
  let url: URL;
  try {
    url = new URL(urlMatch[0].replace(/[)>\]"']+$/, ""));
  } catch {
    return { kind: "invalid" };
  }
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const typeParam = url.searchParams.get("type") ?? "magiclink";
  if (!tokenHash || !LINK_TYPES.includes(typeParam as EmailOtpType)) return { kind: "invalid" };
  return { kind: "link", tokenHash, type: typeParam as EmailOtpType };
}
