/**
 * Links shared in LINE, Instagram, Facebook, TikTok, X, Threads or WeChat open inside the app's
 * own browser. Google blocks sign-in there and "Add to Home Screen" doesn't exist, so the page
 * suggests Safari or Chrome (review fix B3). Pure: from the user-agent string.
 * Android apps that embed a plain WebView mark it with "; wv)". Safari, Chrome and the installed
 * app match none of these.
 */
const IN_APP =
  /\bLine\/|\bInstagram\b|\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bMessenger\b|\bmusical_ly|\bBytedanceWebview\b|\bTikTok\b|\bTwitter for\b|\bBarcelona\b|\bMicroMessenger\b|; wv\)/i;

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP.test(userAgent);
}
