import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BLOCK_KEYS, DEFAULT_BLOCKS, type BlockKey } from "@/content/blocks";
import { DEFAULT_TEMPLATES } from "@/content/defaults";
import {
  CHAIN_AFTER_BEDTIME,
  MIN_DURATION,
  bedtimeDrift,
  dayMinutes,
  nextKaizenTarget,
  parseHHMM,
  planDay,
  resolveDay,
  sd,
  sleepRegularity,
  targetBedtime,
  templateForWeekday,
  type DayPlan,
  type PlanInput,
} from "@/lib/engine";
import { localParts, zonedInstant } from "@/lib/time";

const TZ = "Asia/Bangkok";
const DUR = Object.fromEntries(DEFAULT_BLOCKS.map((b) => [b.key, b.duration_min])) as Record<
  BlockKey,
  number
>;
const tpl = (key: string) => DEFAULT_TEMPLATES.find((t) => t.key === key)!;

/** Local "HH:MM" of an instant in Bangkok. */
const hm = (d: Date) => {
  const p = localParts(d, TZ);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const at = (date: string, time: string) => zonedInstant(date, parseHHMM(time), TZ);
const block = (plan: DayPlan, key: BlockKey) => plan.blocks.find((b) => b.key === key)!;
const shape = (plan: DayPlan) =>
  Object.fromEntries(plan.blocks.map((b) => [b.key, `${hm(b.start)}-${hm(b.end)}`]));

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    date: "2026-11-02",
    timezone: TZ,
    targetWake: "10:00",
    nextTargetWake: "10:00",
    durations: { ...DUR },
    ...over,
  };
}

// 2026-11-02 Mon (free) · 11-03 Tue (free) · 11-04 Wed (class) · 11-05 Thu (optional class)

describe("SPEC §3 scenarios", () => {
  it("normal free day: book chain from a 10:00 wake", () => {
    const p = planDay(input());
    expect(shape(p)).toEqual({
      down: "01:00-02:30",
      sleep: "02:30-10:00",
      wake: "10:00-11:00",
      focus: "11:00-12:30",
      work: "12:30-21:30",
      gradation: "21:30-22:30",
      free: "22:30-01:00",
    });
    expect(p.warnings).toEqual([]);
    expect(p.pushMin).toBe(0);
    expect(p.planned).toBe(false);
  });

  it("normal Wed class day: Focus gives way so Work starts at class (no warning)", () => {
    const wed = resolveDay(tpl("class_wed"), DEFAULT_BLOCKS);
    const p = planDay(input({ date: "2026-11-04", ...wed, nextTargetWake: "07:30" }));
    expect(hm(p.bedtime)).toBe("00:00");
    expect(hm(block(p, "wake").start)).toBe("07:30");
    expect(block(p, "focus").durationMin).toBe(30);
    expect(hm(block(p, "work").start)).toBe("09:00");
    expect(p.fixedEvents[0]).toMatchObject({ id: "class", host: "work" });
    expect(hm(p.fixedEvents[0].start)).toBe("09:00");
    expect(p.warnings).toEqual([]);
  });

  it("bedtime +1.5h on a free day pushes every block, Free shrinks, next night snaps back", () => {
    const base = planDay(input());
    const p = planDay(input({ bedtimeOverride: at("2026-11-02", "04:00") }));
    expect(p.pushMin).toBe(90);
    expect(hm(p.wake)).toBe("11:30");
    for (const k of ["wake", "focus", "work", "gradation"] as BlockKey[]) {
      expect(block(p, k).start.getTime() - block(base, k).start.getTime()).toBe(90 * 60_000);
      expect(block(p, k).durationMin).toBe(DUR[k]);
    }
    expect(block(p, "sleep").durationMin).toBe(450);
    expect(block(p, "free").durationMin).toBe(60);
    expect(p.nextBedtime.getTime()).toBe(base.nextBedtime.getTime()); // snap-back anchor
    // The next day, planned with no override, is back on target.
    const next = planDay(input({ date: "2026-11-03" }));
    expect(next.bedtime.getTime()).toBe(p.nextBedtime.getTime());
    expect(hm(next.wake)).toBe("10:00");
  });

  it("bedtime +2h before Wed class: class unmoved, compression order respected, only 6.5h sleep", () => {
    const wed = resolveDay(tpl("class_wed"), DEFAULT_BLOCKS);
    const p = planDay(
      input({
        date: "2026-11-04",
        ...wed,
        nextTargetWake: "07:30",
        bedtimeOverride: at("2026-11-04", "02:00"),
      }),
    );
    expect(hm(p.fixedEvents[0].start)).toBe("09:00");
    expect(hm(block(p, "work").start)).toBe("09:00");
    // Focus first (→0), then Wake (→30 min), then Sleep last.
    expect(block(p, "focus").durationMin).toBe(0);
    expect(block(p, "wake").durationMin).toBe(30);
    expect(block(p, "sleep").durationMin).toBe(390);
    expect(hm(p.wake)).toBe("08:30");
    expect(p.warnings).toContainEqual({ type: "short_sleep", sleepMin: 390, desiredMin: 450 });
  });

  it("planned late night: tagged planned, Down starts at return, sleep kept, never a miss", () => {
    const p = planDay(input({ lateNightReturn: at("2026-11-02", "03:30") }));
    expect(p.planned).toBe(true);
    expect(shape(p).down).toBe("03:30-04:00");
    expect(hm(p.bedtime)).toBe("04:00");
    expect(block(p, "sleep").durationMin).toBe(450);
    expect(p.warnings.filter((w) => w.type === "short_sleep")).toEqual([]);
  });

  it("late night that ends before the normal bedtime doesn't pull bedtime earlier", () => {
    const p = planDay(input({ lateNightReturn: at("2026-11-02", "00:30") }));
    expect(hm(p.bedtime)).toBe("02:30");
    expect(p.planned).toBe(true);
    expect(block(p, "down").durationMin).toBe(90);
  });

  it("Thu class toggled off: alternate 10:00 wake and no class event", () => {
    const going = resolveDay(tpl("class_thu"), DEFAULT_BLOCKS, { attending: true });
    const skipping = resolveDay(tpl("class_thu"), DEFAULT_BLOCKS, { attending: false });
    expect(going.targetWake).toBe("07:30");
    expect(going.fixedEvents).toHaveLength(1);
    expect(skipping).toMatchObject({ targetWake: "10:00", fixedEvents: [] });
    const p = planDay(input({ date: "2026-11-05", ...skipping, nextTargetWake: "10:00" }));
    expect(hm(p.wake)).toBe("10:00");
    expect(p.fixedEvents).toEqual([]);
    // Unset toggle counts as attending.
    expect(resolveDay(tpl("class_thu"), DEFAULT_BLOCKS).targetWake).toBe("07:30");
  });

  it("sub-slots shift with their block when bedtime is pushed", () => {
    const subSlots = { work: [{ id: "yop", label: "YOP", offsetMin: 0, durationMin: 120 }] };
    const base = planDay(input({ subSlots }));
    const pushed = planDay(input({ subSlots, bedtimeOverride: at("2026-11-02", "04:00") }));
    const a = block(base, "work").subSlots[0];
    const b = block(pushed, "work").subSlots[0];
    expect(hm(a.start)).toBe("12:30");
    expect(hm(b.start)).toBe("14:00");
    expect(b.end.getTime() - b.start.getTime()).toBe(120 * 60_000);
    expect(b.clipped).toBe(false);
  });

  it("sub-slots are clipped (never overflow) when their block is compressed", () => {
    const subSlots = { free: [{ id: "game", label: "Game", offsetMin: 30, durationMin: 120 }] };
    const p = planDay(input({ subSlots, bedtimeOverride: at("2026-11-02", "04:00") }));
    const s = block(p, "free").subSlots[0];
    expect(s.clipped).toBe(true);
    expect(s.end.getTime()).toBe(block(p, "free").end.getTime());
    const gone = planDay(
      input({ subSlots: { free: [{ id: "x", label: "x", offsetMin: 200, durationMin: 10 }] } }),
    );
    expect(block(gone, "free").subSlots[0].clipped).toBe(true);
  });

  it("compression hits the minimums: Down/Wake stop at 30 min, Sleep goes last with a warning", () => {
    // +10h on a free day: window is 14h for 24h of blocks.
    const p = planDay(input({ bedtimeOverride: at("2026-11-02", "12:30") }));
    expect(block(p, "free").durationMin).toBe(0);
    expect(block(p, "gradation").durationMin).toBe(0);
    expect(block(p, "focus").durationMin).toBe(0);
    expect(block(p, "wake").durationMin).toBe(30);
    expect(block(p, "work").durationMin).toBe(540);
    // next Down (D+1) shrank to its 30-min minimum: free ends 30 min before next bedtime
    expect(p.nextBedtime.getTime() - block(p, "free").end.getTime()).toBe(30 * 60_000);
    expect(block(p, "sleep").durationMin).toBe(840 - 30 - 30 - 540);
    expect(p.warnings.some((w) => w.type === "short_sleep")).toBe(true);
  });

  it("reports day_overfull when even the minimums don't fit", () => {
    const p = planDay(input({ bedtimeOverride: at("2026-11-02", "22:00") }));
    expect(p.warnings.some((w) => w.type === "day_overfull")).toBe(true);
    expect(block(p, "sleep").durationMin).toBe(0);
  });

  it("an earlier bedtime gives the extra time to Free", () => {
    const p = planDay(input({ bedtimeOverride: at("2026-11-02", "01:30") }));
    expect(hm(p.wake)).toBe("09:00");
    expect(block(p, "free").durationMin).toBe(210);
    expect(p.pushMin).toBe(-60);
  });
});

describe("fixed events", () => {
  it("conflict warning when the event can't be reached even at minimums", () => {
    const p = planDay(
      input({
        date: "2026-11-04",
        targetWake: "07:30",
        nextTargetWake: "07:30",
        fixedEvents: [{ id: "exam", start: "08:00", end: "10:00" }],
        bedtimeOverride: at("2026-11-04", "07:50"), // only 10 min left, Wake needs 30
      }),
    );
    const w = p.warnings.find((x) => x.type === "fixed_event_conflict");
    expect(w).toMatchObject({ eventId: "exam", lateByMin: 20 });
    expect(hm(p.fixedEvents[0].start)).toBe("08:00"); // never moved
  });

  it("host block grows to cover a long event, taking from later blocks", () => {
    const p = planDay(input({ fixedEvents: [{ id: "trip", start: "13:00", end: "23:30" }] }));
    expect(block(p, "work").end.getTime()).toBeGreaterThanOrEqual(at("2026-11-02", "23:30").getTime());
    expect(block(p, "free").durationMin).toBeLessThan(150);
  });

  it("warns when a host block can't stretch far enough", () => {
    const p = planDay(input({ fixedEvents: [{ id: "allnight", start: "13:00", end: "04:00" }] }));
    expect(p.warnings.some((w) => w.type === "fixed_event_conflict" && w.eventId === "allnight")).toBe(true);
  });

  it("supports a non-default host block", () => {
    const p = planDay(input({ fixedEvents: [{ id: "date", start: "23:00", end: "23:45", host: "free" }] }));
    expect(block(p, "free").start.getTime()).toBeLessThanOrEqual(at("2026-11-02", "23:00").getTime());
    expect(block(p, "free").end.getTime()).toBeGreaterThanOrEqual(at("2026-11-02", "23:45").getTime());
  });

  it("family Saturday event at 12:00 pulls Work earlier", () => {
    const sat = resolveDay(tpl("family_sat"), DEFAULT_BLOCKS);
    const p = planDay(input({ date: "2026-11-07", ...sat, nextTargetWake: "10:00" }));
    expect(block(p, "work").start.getTime()).toBeLessThanOrEqual(at("2026-11-07", "12:00").getTime());
    expect(p.warnings).toEqual([]);
  });
});

describe("guardrails", () => {
  it("gym-close warning when a gym slot ends after 22:00", () => {
    const p = planDay(
      input({
        gymClose: "22:00",
        subSlots: { gradation: [{ id: "gym", label: "Gym", offsetMin: 0, durationMin: 60, kind: "gym" }] },
      }),
    );
    // Gradation 21:30–22:30 → gym 21:30–22:30 ends after close.
    expect(p.warnings).toContainEqual(expect.objectContaining({ type: "gym_after_close", slotId: "gym" }));
    const ok = planDay(
      input({
        gymClose: "22:00",
        subSlots: { work: [{ id: "gym", label: "Gym", offsetMin: 0, durationMin: 60, kind: "gym" }] },
      }),
    );
    expect(ok.warnings).toEqual([]);
    const nonGym = planDay(
      input({
        gymClose: "22:00",
        subSlots: { gradation: [{ id: "read", label: "Read", offsetMin: 0, durationMin: 60 }] },
      }),
    );
    expect(nonGym.warnings).toEqual([]);
  });

  it("drift warning when bedtime is > 60 min from the 7-day mean (handles midnight)", () => {
    const recent = ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"].map(
      (d, i) => at(d, i % 2 ? "02:00" : "03:00"),
    );
    expect(bedtimeDrift(at("2026-11-02", "02:30"), recent, TZ)).toBe(0);
    const p = planDay(input({ recentBedtimes: recent, bedtimeOverride: at("2026-11-02", "04:00") }));
    expect(p.warnings).toContainEqual({ type: "bedtime_drift", deltaMin: 90 });
    expect(planDay(input({ recentBedtimes: recent })).warnings).toEqual([]);
    // 23:30 and 00:30 average to midnight, not noon.
    expect(
      bedtimeDrift(at("2026-11-02", "00:00"), [at("2026-10-31", "23:30"), at("2026-11-01", "00:30")], TZ),
    ).toBe(0);
    expect(bedtimeDrift(at("2026-11-02", "00:00"), [], TZ)).toBeNull();
  });

  it("sleep regularity score: 100 when identical, lower with spread, 0 at ≥2h SD", () => {
    const same = sleepRegularity(
      [at("2026-11-01", "02:30"), at("2026-11-02", "02:30")],
      [at("2026-11-01", "10:00"), at("2026-11-02", "10:00")],
      TZ,
    );
    expect(same).toEqual({ bedSdMin: 0, wakeSdMin: 0, score: 100 });
    const spread = sleepRegularity(
      [at("2026-11-01", "23:30"), at("2026-11-02", "01:30")],
      [at("2026-11-01", "07:30"), at("2026-11-02", "09:30")],
      TZ,
    );
    expect(spread).toEqual({ bedSdMin: 60, wakeSdMin: 60, score: 50 });
    const chaos = sleepRegularity(
      [at("2026-11-01", "20:00"), at("2026-11-02", "06:00")],
      [at("2026-11-01", "05:00"), at("2026-11-02", "15:00")],
      TZ,
    );
    expect(chaos.score).toBe(0);
    expect(sd([5])).toBe(0);
    expect(dayMinutes(at("2026-11-01", "07:45"), TZ)).toBe(465);
  });

  it("kaizen moves the target 15 min earlier after ≥5/7, down to the floor, only when enabled", () => {
    const k = { enabled: true, step_min: 15, floor: "08:30", threshold: 5 };
    expect(nextKaizenTarget("10:00", 5, k)).toBe("09:45");
    expect(nextKaizenTarget("10:00", 4, k)).toBe("10:00");
    expect(nextKaizenTarget("08:40", 7, k)).toBe("08:30");
    expect(nextKaizenTarget("08:30", 7, k)).toBe("08:30");
    expect(nextKaizenTarget("07:30", 7, k)).toBe("07:30");
    expect(nextKaizenTarget("10:00", 7, { ...k, enabled: false })).toBe("10:00");
  });
});

describe("time handling", () => {
  it("bedtime before midnight (07:00 wake) crosses into the previous calendar day", () => {
    const p = planDay(input({ date: "2026-11-04", targetWake: "07:00", nextTargetWake: "07:00" }));
    expect(hm(p.bedtime)).toBe("23:30");
    expect(localParts(p.bedtime, TZ).day).toBe(3);
  });

  it("is timezone-agnostic: same local shape in New York across DST start", () => {
    const ny = planDay({ ...input(), date: "2026-03-08", timezone: "America/New_York" });
    const p = localParts(ny.wake, "America/New_York");
    expect(`${p.hour}:${p.minute}`).toBe("10:0");
  });

  it("works across month end and leap day", () => {
    expect(planDay(input({ date: "2026-10-31" })).nextBedtime.toISOString()).toBe(
      targetBedtime("2026-11-01", "10:00", 450, TZ).toISOString(),
    );
    const leap = planDay(input({ date: "2028-02-29" }));
    expect(localParts(leap.wake, TZ)).toMatchObject({ month: 2, day: 29, hour: 10 });
  });

  it("rejects bad input", () => {
    expect(() => parseHHMM("25:00")).toThrow();
    expect(() => parseHHMM("abc")).toThrow();
    expect(parseHHMM("07:30:00")).toBe(450);
    expect(() => planDay(input({ durations: { ...DUR, work: -1 } }))).toThrow();
  });

  it("template for weekday picks exactly the auto-applied one", () => {
    expect(templateForWeekday(DEFAULT_TEMPLATES, 3)!.key).toBe("class_wed");
    expect(templateForWeekday(DEFAULT_TEMPLATES, 6)!.key).toBe("family_sat");
    expect(templateForWeekday(DEFAULT_TEMPLATES, 1)!.key).toBe("free_weekday");
  });

  it("template block overrides change durations", () => {
    const r = resolveDay({ ...tpl("free_weekday"), blocks: { work: { duration_min: 300 } } }, DEFAULT_BLOCKS);
    expect(r.durations.work).toBe(300);
    expect(r.durations.free).toBe(150);
  });
});

// ---------------------------------------------------------------------------------------
// QA_QC §6 engine invariants (property-based)
// ---------------------------------------------------------------------------------------
const durationsArb = fc.record(
  Object.fromEntries(
    BLOCK_KEYS.map((k) => [k, fc.integer({ min: 0, max: k === "sleep" ? 600 : 600 })]),
  ) as Record<BlockKey, fc.Arbitrary<number>>,
);
const wakeArb = fc
  .integer({ min: 5 * 60, max: 11 * 60 })
  .map((m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const eventArb = fc.option(
  fc.record({ start: fc.integer({ min: 8 * 60, max: 18 * 60 }), len: fc.integer({ min: 15, max: 480 }) }),
  { nil: undefined },
);

describe("engine invariants (fast-check)", () => {
  const scenario = fc.record({
    durations: durationsArb,
    wake: wakeArb,
    nextWake: wakeArb,
    pushMin: fc.integer({ min: -180, max: 720 }),
    late: fc.option(fc.integer({ min: 0, max: 600 }), { nil: undefined }),
    event: eventArb,
  });

  type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;
  const toInput = (s: Scenario): PlanInput => {
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const bt = targetBedtime("2026-11-04", s.wake, s.durations.sleep, TZ);
    return {
      date: "2026-11-04",
      timezone: TZ,
      targetWake: s.wake,
      nextTargetWake: s.nextWake,
      durations: s.durations,
      bedtimeOverride: new Date(bt.getTime() + s.pushMin * 60_000),
      lateNightReturn: s.late === undefined ? undefined : new Date(bt.getTime() + s.late * 60_000),
      fixedEvents: s.event
        ? [
            {
              id: "e",
              start: fmt(s.event.start),
              end: fmt(Math.min(s.event.start + s.event.len, 23 * 60 + 59)),
            },
          ]
        : [],
    };
  };

  it("blocks are contiguous and never overlap", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const p = planDay(toInput(s));
        for (let i = 1; i < p.blocks.length; i++) {
          expect(p.blocks[i].start.getTime()).toBe(p.blocks[i - 1].end.getTime());
          expect(p.blocks[i].durationMin).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it("fixed events are never moved", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const inp = toInput(s);
        const p = planDay(inp);
        for (const e of inp.fixedEvents ?? []) {
          const out = p.fixedEvents.find((x) => x.id === e.id)!;
          expect(out.start.getTime()).toBe(zonedInstant(inp.date, parseHHMM(e.start), TZ).getTime());
        }
      }),
    );
  });

  it("minimum durations are respected (never below min(desired, minimum))", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const p = planDay(toInput(s));
        for (const b of p.blocks.slice(1)) {
          expect(b.durationMin).toBeGreaterThanOrEqual(Math.min(b.desiredMin, MIN_DURATION[b.key]));
        }
      }),
    );
  });

  it("the day total is consistent: chain fills exactly [bedtime, next bedtime] unless overfull", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const p = planDay(toInput(s));
        if (p.warnings.some((w) => w.type === "day_overfull" || w.type === "fixed_event_conflict")) return;
        const free = p.blocks[p.blocks.length - 1];
        const nextDown = (p.nextBedtime.getTime() - free.end.getTime()) / 60_000;
        expect(nextDown).toBeGreaterThanOrEqual(Math.min(s.durations.down, MIN_DURATION.down));
        expect(nextDown).toBeLessThanOrEqual(Math.max(s.durations.down, MIN_DURATION.down));
        const chain = p.blocks.slice(1).reduce((t, b) => t + b.durationMin, 0) + nextDown;
        expect(chain).toBe((p.nextBedtime.getTime() - p.bedtime.getTime()) / 60_000);
      }),
    );
  });

  it("the sleep warning fires if and only if sleep < configured duration", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const p = planDay(toInput(s));
        const sleep = p.blocks.find((b) => b.key === "sleep")!.durationMin;
        expect(p.warnings.some((w) => w.type === "short_sleep")).toBe(sleep < s.durations.sleep);
      }),
    );
  });

  it("snap-back: the next bedtime is the D+1 target regardless of tonight's push", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const p = planDay(toInput(s));
        expect(p.nextBedtime.getTime()).toBe(
          targetBedtime("2026-11-05", s.nextWake, s.durations.sleep, TZ).getTime(),
        );
      }),
    );
  });

  it("planned deviations are flagged planned (so they never create misses)", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        expect(planDay(toInput(s)).planned).toBe(s.late !== undefined);
      }),
    );
  });

  it("chain order is always Down, Sleep, Wake, Focus, Work, Gradation, Free", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        expect(planDay(toInput(s)).blocks.map((b) => b.key)).toEqual([
          "down",
          ...CHAIN_AFTER_BEDTIME.slice(0, 6),
        ]);
      }),
    );
  });
});
