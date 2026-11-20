import { describe, expect, it } from "vitest";
import { GROUP_CARDS, MORE_GROUPS, groupOfCard, hashRedirect, isMoreGroup } from "@/lib/more/groups";
import { SETUP_HREF } from "@/content/unlocks";

describe("More in four groups (review fix D)", () => {
  it("every card is on exactly one page", () => {
    const all = MORE_GROUPS.flatMap((g) => GROUP_CARDS[g]);
    expect(new Set(all).size).toBe(all.length);
  });
  it("old /more#<card> links go to the card's page; #setup and unknown anchors stay on /more", () => {
    expect(hashRedirect("#language")).toBe("/more/preferences#language");
    expect(hashRedirect("#install")).toBe("/more/account#install");
    expect(hashRedirect("#exercise")).toBe("/more/setup#exercise");
    expect(hashRedirect("#notifications")).toBe("/more/preferences#notifications");
    expect(hashRedirect("#share")).toBe("/more/sharing#share");
    expect(hashRedirect("#calendar")).toBe("/more/sharing#calendar");
    expect(hashRedirect("#sound")).toBe("/more/preferences#sound");
    expect(hashRedirect("#privacy")).toBe("/more/account#privacy");
    expect(hashRedirect("#setup")).toBeNull();
    expect(hashRedirect("")).toBeNull();
    expect(hashRedirect("#nope")).toBeNull();
    expect(hashRedirect("#%2F%2Fevil.example")).toBeNull();
  });
  it("only the four groups are pages", () => {
    expect(isMoreGroup("sharing")).toBe(true);
    expect(isMoreGroup("../today")).toBe(false);
    expect(groupOfCard("account")).toBe("account");
  });
  it("setup steps link straight to their card's page", () => {
    for (const href of Object.values(SETUP_HREF)) {
      if (!href.startsWith("/more")) continue;
      const [path, id] = href.split("#");
      expect(path).toBe(`/more/${groupOfCard(id!)}`);
    }
  });
});
