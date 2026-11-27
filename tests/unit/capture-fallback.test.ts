import { describe, expect, it } from "vitest";
import { parseCapture } from "@/lib/backlog/parse";

/** G7 G S2-4: the quick-add fallback in Plan's capture never eats a deadline task. */
const TODAY = "2026-12-02"; // Wednesday
describe("capture: the quick-add fallback", () => {
  it("Thai clock words with a written date become an appointment", () => {
    expect(parseCapture("พรุ่งนี้ บ่าย 2 ประชุม", TODAY)).toMatchObject({
      title: "ประชุม",
      appointment: { date: "2026-12-03", start: "14:00", end: "15:00" },
    });
  });
  it("a deadline stays a task with its deadline", () => {
    const c = parseCapture("due fri 5pm report", TODAY);
    expect(c.appointment).toBeUndefined();
    expect(c.deadline).toBe("2026-12-04");
    const th = parseCapture("ส่ง ศุกร์ บ่าย 2 รายงาน", TODAY);
    expect(th.appointment).toBeUndefined();
    expect(th.deadline).toBe("2026-12-04");
  });
  it("no written date: still a task", () => {
    expect(parseCapture("call mom 3pm", TODAY).appointment).toBeUndefined();
    expect(parseCapture("บ่าย 2 อ่านหนังสือ", TODAY).appointment).toBeUndefined();
  });
  it("the title doesn't repeat what was read, and tags/priority survive", () => {
    const c = parseCapture("จันทร์ 3 โมง ติวเลข #class !1", TODAY);
    expect(c).toMatchObject({ title: "ติวเลข", tag: "class", priority: "must" });
    expect(c.appointment).toMatchObject({ date: "2026-12-07", start: "15:00" });
  });
  it("an appointment with nothing else typed keeps the appointment", () => {
    expect(parseCapture("sun 9am", TODAY).appointment).toMatchObject({ date: "2026-12-06", start: "09:00" });
  });
  it("23:59 ends after it starts (S2-3)", () => {
    expect(parseCapture("พรุ่งนี้ 23:59 ส่งงาน", TODAY).appointment).toMatchObject({
      start: "23:59",
      end: "00:59",
    });
  });
});
