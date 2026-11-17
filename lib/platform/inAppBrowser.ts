/**
 * Links shared in LINE, Instagram or Facebook open inside the app's own browser. Google blocks
 * sign-in there and "Add to Home Screen" doesn't exist, so the page suggests Safari or Chrome
 * (review fix B3). Pure: from the user-agent string.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return /\bLine\/|\bInstagram\b|\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bMessenger\b/i.test(userAgent);
}
