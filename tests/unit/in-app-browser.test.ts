import { describe, expect, it } from "vitest";
import { isInAppBrowser } from "@/lib/platform/inAppBrowser";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
describe("in-app browsers (review fix B3)", () => {
  it("spots LINE, Instagram, Facebook and Messenger", () => {
    expect(isInAppBrowser(`${IOS} Mobile/15E148 Safari Line/14.9.0`)).toBe(true);
    expect(isInAppBrowser(`${IOS} Mobile/15E148 Instagram 330.0.0.29.95 (iPhone15,2; iOS 17_5)`)).toBe(true);
    expect(isInAppBrowser(`${IOS} Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.33.109;]`)).toBe(true);
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0 Mobile Safari/537.36 Line/14.9.0/IAB",
      ),
    ).toBe(true);
  });
  it("leaves Safari, Chrome and the installed app alone", () => {
    expect(isInAppBrowser(`${IOS} Version/17.5 Mobile/15E148 Safari/604.1`)).toBe(false);
    expect(isInAppBrowser(`${IOS} CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1`)).toBe(false);
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(isInAppBrowser("")).toBe(false);
  });
});
