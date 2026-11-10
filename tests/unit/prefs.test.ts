import { describe, expect, it } from "vitest";
import { usePrefs } from "@/lib/store/prefs";

describe("language sync (CJ-14 race)", () => {
  it("a save of the old language doesn't mark a newer pick as saved", () => {
    const s = usePrefs.getState();
    s.applyLocale("en");
    // Sign-in sync is still writing "en" when the user picks ไทย…
    usePrefs.getState().setLocale("th");
    // …then that write lands: "th" is still unsaved, so a reload must keep it.
    usePrefs.getState().markLocaleSynced("en");
    expect(usePrefs.getState()).toMatchObject({ locale: "th", localeDirty: true });
    // The user's own save lands.
    usePrefs.getState().markLocaleSynced("th");
    expect(usePrefs.getState()).toMatchObject({ locale: "th", localeDirty: false });
  });
});
