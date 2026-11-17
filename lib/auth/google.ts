import { isInAppBrowser } from "@/lib/platform/inAppBrowser";

/**
 * Whether to show "Continue with Google" (review fix B2). It ships switched off: Minnie turns it
 * on with `NEXT_PUBLIC_GOOGLE_LOGIN=1` after the one-time setup in docs/GOOGLE-LOGIN-SETUP.md.
 * Never inside an in-app browser: Google refuses to sign people in there.
 */
export function googleLoginOffered(flag: string | undefined, userAgent: string): boolean {
  return flag === "1" && !isInAppBrowser(userAgent);
}
