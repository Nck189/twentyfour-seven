import { expect, it } from "vitest";
import { festivalMonth, monthRange } from "@/lib/seasons/festival";

it("the harvest festival shows in a month's last 3 days and the next month's first 3", () => {
  expect(festivalMonth("2026-11-27")).toBeNull();
  expect(festivalMonth("2026-11-28")).toBe("2026-11");
  expect(festivalMonth("2026-11-30")).toBe("2026-11");
  expect(festivalMonth("2026-12-01")).toBe("2026-11");
  expect(festivalMonth("2026-12-03")).toBe("2026-11");
  expect(festivalMonth("2026-12-04")).toBeNull();
  expect(festivalMonth("2027-02-26")).toBe("2027-02");
  expect(festivalMonth("2027-01-02")).toBe("2026-12");
});

it("month ranges, incl. February and year ends", () => {
  expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  expect(monthRange("2027-02")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
  expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
});
