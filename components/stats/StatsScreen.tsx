"use client";

import { useTranslations } from "next-intl";
import { EstimateCard } from "./EstimateCard";
import { COFFEE_MIN_DAYS } from "@/lib/game/cafe";
import { useMemo, useRef, useState } from "react";
import { Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { SomArt } from "@/components/art/Som";
import { TicketArt } from "@/components/art/Ticket";
import { StreakCalendar } from "@/components/streak/StreakChip";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented } from "@/components/ui/Segmented";
import { dayOee } from "@/lib/game/outcome";
import { somWeek } from "@/lib/game/somLines";
import {
  heatmap,
  homeVsOut,
  imrChart,
  pareto,
  periodCompare,
  sleepRegularity,
  splitWeekend,
  steadiness,
  usedBlocks,
  usedSince,
  weekSummary,
} from "@/lib/stats/stats";
import { useStats, type StatsData } from "@/lib/stats/useStats";
import { sfx } from "@/lib/sound/sfx";
import { useStreak, type StreakView } from "@/lib/streak/useStreak";
import { addDays, isoWeekday } from "@/lib/time";

const hhmm = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};
/** Axis ticks: H:mm without a leading zero, so they fit at 390 px (G7 R-M10-R5). */
const hmm = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
};
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const shortDate = (d: string) => d.slice(8, 10);

/** A time axis on whole hours (or half hours for a tight range), so ticks read 7:00, 8:00. */
function timeAxis(values: number[]): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = max - min > 150 ? 60 : 30;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

const AXIS = { fontSize: 11, fill: "var(--ui-text-muted)" } as const;

function Card({ title, label, children }: { title: string; label?: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label ?? title}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-3 lg:mx-6"
    >
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Takeaway({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-base font-bold">{children}</p>;
}

function Empty() {
  const t = useTranslations("stats");
  return <p className="text-sm text-muted">{t("notEnough")}</p>;
}

/** Sunday night: the week in a few numbers, Keep / Problem / Try, +3 tickets (SPEC §7). */
function WeeklyReview({
  data,
  submit,
}: {
  data: StatsData;
  submit: ReturnType<typeof useStats>["submitReview"];
}) {
  const t = useTranslations("stats");
  const blocks = useTranslations("blocks");
  const [keep, setKeep] = useState("");
  const [problem, setProblem] = useState("");
  const [tryNext, setTryNext] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "granted" | "saved" | "error">("idle");
  const busy = useRef(false);
  const week = data.review?.week_start;
  const summary = useMemo(
    () =>
      week
        ? weekSummary(
            data.days.filter((d) => d.date >= week && d.date <= addDays(week, 6)),
            usedSince(data.days),
          )
        : null,
    [data.days, week],
  );
  if (!data.review || !week || !summary) return null;
  if (data.review.done && state === "idle")
    return (
      <Card title={t("review.title")}>
        <p className="text-sm text-muted">{t("review.doneAlready")}</p>
      </Card>
    );
  // Blank includes zero-width spaces, which String.trim() keeps (R-M10-R6).
  const blank = (x: string) => x.replace(/[\s\u200b\ufeff]/g, "") === "";
  const ready = !blank(keep) && !blank(problem) && !blank(tryNext);
  const save = async () => {
    if (busy.current || !ready) return;
    busy.current = true;
    setState("busy");
    try {
      const r = await submit(keep, problem, tryNext);
      if (r.granted) sfx.jingle(1);
      setState(r.granted ? "granted" : "saved");
    } catch {
      setState("error");
    } finally {
      busy.current = false;
    }
  };
  const field = (id: string, label: string, hint: string, value: string, set: (v: string) => void) => (
    <label className="mb-2 block" htmlFor={id}>
      <span className="text-sm font-bold">{label}</span>
      <textarea
        id={id}
        value={value}
        maxLength={280}
        rows={2}
        placeholder={hint}
        onChange={(e) => set(e.target.value)}
        className="mt-1 block w-full rounded-xl bg-surface-2 p-2 text-base"
      />
    </label>
  );
  return (
    <Card title={t("review.title")}>
      {(() => {
        // Sunday with Som: a kind reaction to this week before the numbers (docs/STORY.md).
        const som = somWeek(summary);
        return (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-primary-soft p-3">
            <SomArt pose={som.pose} className="h-14 w-14 shrink-0" />
            <p className="text-sm font-bold">{t(`review.som.${som.mood}`, { n: som.n })}</p>
          </div>
        );
      })()}
      <p className="mb-2 text-sm text-muted">{t("review.intro")}</p>
      <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("review.score")}</dt>
          <dd className="text-xl font-extrabold">{pct(summary.avgOee)}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("review.minimum")}</dt>
          <dd className="text-xl font-extrabold">{summary.minimumDays}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("review.perfect")}</dt>
          <dd className="text-xl font-extrabold">{summary.perfectDays}</dd>
        </div>
      </dl>
      {summary.bestBlock && (
        <p className="mb-3 text-sm">
          {t("review.best", { block: blocks(`name.${summary.bestBlock}`) })}
          {summary.worstBlock && <> · {t("review.worst", { block: blocks(`name.${summary.worstBlock}`) })}</>}
        </p>
      )}
      {state === "granted" || state === "saved" ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-primary-soft p-3 font-bold text-primary"
        >
          {state === "granted" && <TicketArt className="h-8 w-12 shrink-0" kind="night" />}
          {state === "granted" ? t("review.granted") : t("review.saved")}
        </p>
      ) : (
        <>
          {field("kpt-keep", t("review.keep"), t("review.keepHint"), keep, setKeep)}
          {field("kpt-problem", t("review.problem"), t("review.problemHint"), problem, setProblem)}
          {field("kpt-try", t("review.try"), t("review.tryHint"), tryNext, setTryNext)}
          <Button className="w-full" disabled={!ready || state === "busy"} onClick={() => void save()}>
            {t("review.save")}
          </Button>
          {state === "error" && (
            <p role="alert" className="mt-2 rounded-xl bg-accent-soft p-2 text-sm font-bold">
              {t("review.error")}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/** Wake-up times (SPEC §7 I-MR, shown plainly): the normal range as a soft band, odd mornings marked. */
function WakeChart({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const [part, setPart] = useState<"weekday" | "weekend">("weekday");
  const chart = imrChart(splitWeekend(data.wakes)[part]);
  const out = chart?.points.filter((p) => p.out).length ?? 0;
  const axis = chart ? timeAxis([...chart.points.map((p) => p.value), chart.lcl, chart.ucl]) : null;
  return (
    <Card title={t("wake.title")}>
      <div className="mb-2">
        <Segmented
          compact
          label={t("wake.title")}
          value={part}
          onChange={setPart}
          options={(["weekday", "weekend"] as const).map((k) => ({ value: k, label: t(`wake.${k}`) }))}
        />
      </div>
      {chart && axis ? (
        <>
          <Takeaway>{t("wake.mean", { time: hhmm(chart.mean), sd: Math.round(chart.sigma) })}</Takeaway>
          {out > 0 && <p className="-mt-1 mb-2 text-sm font-bold text-warn">{t("wake.out", { n: out })}</p>}
          <div className="h-44" role="img" aria-label={t("wake.aria", { time: hhmm(chart.mean), n: out })}>
            <ResponsiveContainer>
              <LineChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[axis.lo, axis.hi]}
                  ticks={axis.ticks}
                  tickFormatter={hmm}
                  tick={AXIS}
                  width={50}
                  axisLine={false}
                  tickLine={false}
                  reversed
                />
                <ReferenceArea
                  y1={Math.max(chart.lcl, 0)}
                  y2={chart.ucl}
                  fill="var(--ui-primary-soft)"
                  fillOpacity={1}
                />
                <ReferenceLine y={chart.mean} stroke="var(--ui-primary)" strokeDasharray="4 4" />
                <Line
                  dataKey="value"
                  stroke="var(--ui-primary)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: { out: boolean }; index?: number }) => (
                    <circle
                      key={p.index}
                      cx={p.cx}
                      cy={p.cy}
                      r={p.payload?.out ? 5 : 3}
                      fill={p.payload?.out ? "var(--ui-warn)" : "var(--ui-primary)"}
                    />
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted">{t("wake.help")}</p>
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function Regularity({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const r = sleepRegularity(data.sleep);
  const drift =
    r.wakeDrift === null
      ? null
      : Math.abs(r.wakeDrift) < 2
        ? t("sleep.steady")
        : r.wakeDrift > 0
          ? t("sleep.later", { n: Math.round(r.wakeDrift) })
          : t("sleep.earlier", { n: Math.round(-r.wakeDrift) });
  const tile = (label: string, sdMin: number | null) => (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg leading-tight font-extrabold">
        {sdMin === null ? "–" : t(`sleep.level.${steadiness(sdMin)}`)}
      </dd>
      {sdMin !== null && <dd className="text-xs text-muted">{t("sleep.min", { n: Math.round(sdMin) })}</dd>}
    </div>
  );
  return (
    <Card title={t("sleep.title")}>
      {r.wakeSd === null && r.bedSd === null ? (
        <Empty />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            {tile(t("sleep.bed"), r.bedSd)}
            {tile(t("sleep.wake"), r.wakeSd)}
          </dl>
          {drift && <p className="mt-2 text-sm">{drift}</p>}
          <p className="mt-1 text-xs text-muted">{t("sleep.help")}</p>
        </>
      )}
    </Card>
  );
}

/** Som's café (docs/STORY.md): coffee vs bedtime from explicit answers only; never claims cause. */
function Coffee({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const c = data.coffee;
  if (!c) return null;
  return (
    <Card title={t("coffee.title")}>
      {c.ready ? (
        <>
          <Takeaway>
            {Math.abs(c.diff) < 10
              ? t("coffee.same")
              : c.diff > 0
                ? t("coffee.later", { n: c.diff })
                : t("coffee.earlier", { n: -c.diff })}
          </Takeaway>
          <p className="text-sm text-muted">{t("coffee.from", { late: c.late, other: c.other })}</p>
        </>
      ) : (
        <p className="text-sm text-muted">
          {t("coffee.collecting", { late: c.late, other: c.other, need: COFFEE_MIN_DAYS })}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">{t("coffee.help")}</p>
    </Card>
  );
}

function Heat({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const blocks = useTranslations("blocks");
  const h = heatmap(data.days);
  const rows = usedBlocks(data.days);
  const days = [1, 2, 3, 4, 5, 6, 7] as const;
  const any = rows.some((b) => days.some((w) => h[b][w]!.judged > 0));
  const shade = (rate: number | null) =>
    rate === null
      ? "var(--ui-surface-2)"
      : `color-mix(in srgb, var(--ui-primary) ${Math.round(15 + rate * 85)}%, var(--ui-surface-2))`;
  return (
    <Card title={t("heat.title")}>
      {any ? (
        <>
          <table className="w-full table-fixed border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-20" />
                {days.map((w) => (
                  <th key={w} scope="col" className="font-bold text-muted">
                    {t(`heat.day.${w}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b}>
                  <th scope="row" className="truncate text-left font-bold">
                    {blocks(`name.${b}`)}
                  </th>
                  {days.map((w) => {
                    const c = h[b][w]!;
                    const rate = c.judged ? c.success / c.judged : null;
                    return (
                      <td
                        key={w}
                        aria-label={
                          rate === null ? t("heat.none") : t("heat.cell", { pct: pct(rate), n: c.judged })
                        }
                        className="h-7 rounded-md"
                        style={{ background: shade(rate) }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted" aria-hidden="true">
            {t("heat.less")}
            {[0, 0.5, 1].map((r) => (
              <span key={r} className="inline-block h-3 w-5 rounded" style={{ background: shade(r) }} />
            ))}
            {t("heat.more")}
          </p>
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

const REASONS = ["sleepy", "phone", "interruption", "social", "sick", "other"];

/** Miss reasons as plain bars, most common first (SPEC §7 Pareto, without the cumulative line). */
function Misses({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const reasons = useTranslations("night.reasons");
  const rows = pareto(data.days).map((r) => ({
    ...r,
    label: REASONS.includes(r.reason) ? reasons(r.reason as "other") : r.reason,
  }));
  const max = rows[0]?.count ?? 1;
  return (
    <Card title={t("pareto.title")}>
      {rows.length ? (
        <>
          <Takeaway>{t("pareto.top", { reason: rows[0]!.label, pct: pct(rows[0]!.share) })}</Takeaway>
          <ul aria-label={t("pareto.aria", { reason: rows[0]!.label, pct: pct(rows[0]!.share) })}>
            {rows.map((r) => (
              <li key={r.reason} className="mb-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">{r.label}</span>
                  <span className="text-muted">{t("pareto.times", { n: r.count })}</span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round((r.count / max) * 100)}%`, background: "var(--art-pink)" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">{t("pareto.none")}</p>
      )}
    </Card>
  );
}

function HomeOut({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const r = homeVsOut(data.days);
  if (r.home.logged + r.out.logged === 0)
    return (
      <Card title={t("place.title")}>
        <Empty />
      </Card>
    );
  return (
    <Card title={t("place.title")}>
      <dl className="grid grid-cols-2 gap-2">
        {(["home", "out"] as const).map((k) => (
          <div key={k} className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{t(`place.${k}`)}</dt>
            <dd className="text-2xl font-extrabold">{pct(r[k].rate)}</dd>
            <dd className="text-xs text-muted">{t("place.blocks", { n: r[k].logged })}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{t("place.help")}</p>
    </Card>
  );
}

/** Overview: the few numbers most people want, IG-insights style (Minnie 2026-11-10). */
function Overview({ data, streak }: { data: StatsData; streak: StreakView | null }) {
  const t = useTranslations("stats");
  const blocks = useTranslations("blocks");
  const reasons = useTranslations("night.reasons");
  const cmp = periodCompare(data.days, data.today);
  const cut = addDays(data.today, -7);
  const week = data.days.filter((d) => d.date >= cut);
  const summary = weekSummary(week, usedSince(data.days));
  const top = pareto(week)[0];
  const split = splitWeekend(data.wakes);
  const weekdayWake = imrChart(split.weekday);
  const wake = weekdayWake ?? imrChart(data.wakes);
  const bars = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(data.today, i - 7);
    const d = data.days.find((x) => x.date === date);
    return { date, score: d ? (dayOee(d)?.oee ?? null) : null };
  });
  const delta = cmp.delta === null ? null : Math.round(cmp.delta * 100);
  const highlights = [
    summary.bestBlock && { k: "best", v: blocks(`name.${summary.bestBlock}`) },
    summary.worstBlock && { k: "worst", v: blocks(`name.${summary.worstBlock}`) },
    top && {
      k: "reason",
      v: REASONS.includes(top.reason) ? reasons(top.reason as "other") : top.reason,
    },
  ].filter(Boolean) as { k: "best" | "worst" | "reason"; v: string }[];
  return (
    <>
      <section
        aria-label={t("score.title")}
        className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
      >
        <p className="text-sm text-muted">{t("score.period")}</p>
        <h2 className="font-bold">{t("score.title")}</h2>
        {cmp.now === null ? (
          <Empty />
        ) : (
          <>
            <p className="mt-1 flex items-baseline gap-3">
              <span className="text-5xl font-extrabold tracking-tight">{pct(cmp.now)}</span>
              {delta !== null && (
                <span className={`text-sm font-bold ${delta >= 0 ? "text-primary" : "text-muted"}`}>
                  {t("score.delta", { n: delta > 0 ? `+${delta}` : `${delta}` })}
                </span>
              )}
            </p>
            <div
              role="img"
              aria-label={t("score.aria", { pct: pct(cmp.now) })}
              className="relative mt-3 grid h-24 grid-cols-7 items-end gap-2"
            >
              {/* The 80% line (a Perfect-day score); bars stay one colour (R-M10-R3-4). */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-line"
                style={{ bottom: "80%" }}
              />
              {bars.map((b) => (
                <div key={b.date} className="flex h-full flex-col justify-end">
                  {b.score === null ? (
                    // No score (no data, Vacation or Sick): a grey stub, not a 0% bar.
                    <div className="h-1.5 w-full rounded-md bg-line" />
                  ) : (
                    <div
                      className="w-full rounded-md bg-primary"
                      style={{ height: `${Math.max(4, Math.round(b.score * 100))}%` }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-2 text-center text-xs text-muted" aria-hidden="true">
              {bars.map((b) => (
                <span key={b.date}>{t(`heat.day.${isoWeekday(b.date) as 1 | 2 | 3 | 4 | 5 | 6 | 7}`)}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{t("score.help")}</p>
          </>
        )}
      </section>
      <dl className="mx-4 mb-3 grid grid-cols-2 gap-3 lg:mx-6">
        <div className="rounded-[var(--radius-lg)] bg-surface p-4">
          <dt className="text-sm text-muted">{t(weekdayWake ? "tile.wakeWeekdays" : "tile.wake")}</dt>
          <dd className="text-3xl font-extrabold">{wake ? hhmm(wake.mean) : "–"}</dd>
          {wake && <dd className="text-xs text-muted">{t("sleep.min", { n: Math.round(wake.sigma) })}</dd>}
        </div>
        <div className="rounded-[var(--radius-lg)] bg-surface p-4">
          <dt className="text-sm text-muted">{t("tile.streak")}</dt>
          <dd className="text-3xl font-extrabold">{streak ? t("tile.days", { n: streak.streak }) : "–"}</dd>
          {streak && <dd className="text-xs text-muted">{t("tile.best", { n: streak.best })}</dd>}
        </div>
      </dl>
      {highlights.length > 0 && (
        <Card title={t("highlights.title")}>
          <dl>
            {highlights.map((h) => (
              <div
                key={h.k}
                className="flex justify-between gap-3 border-t border-line py-2 first:border-t-0"
              >
                <dt className="text-muted">{t(`highlights.${h.k}`)}</dt>
                <dd className="text-right font-bold">{h.v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}

type Tab = "overview" | "sleep" | "days";

/** The Stats screen for loaded data (also used by the /dev/stats preview): three short tabs. */
export function StatsBody({
  data,
  submit,
  streak,
  initialTab = "overview",
}: {
  data: StatsData;
  submit: ReturnType<typeof useStats>["submitReview"];
  streak: StreakView | null;
  initialTab?: Tab;
}) {
  const t = useTranslations("stats");
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="pb-6">
      <div className="mx-4 mb-3 lg:mx-6">
        <Segmented
          label={t("tabs.label")}
          value={tab}
          onChange={setTab}
          options={(["overview", "sleep", "days"] as const).map((k) => ({ value: k, label: t(`tabs.${k}`) }))}
        />
      </div>
      {tab === "overview" && (
        <>
          <WeeklyReview data={data} submit={submit} />
          <Overview data={data} streak={streak} />
          <EstimateCard />
        </>
      )}
      {tab === "sleep" && (
        <>
          <WakeChart data={data} />
          <Regularity data={data} />
          <Coffee data={data} />
        </>
      )}
      {tab === "days" && (
        <>
          {streak && (
            <Card title={t("streak")}>
              <StreakCalendar view={streak} />
            </Card>
          )}
          <Heat data={data} />
          <Misses data={data} />
          <HomeOut data={data} />
        </>
      )}
    </div>
  );
}

/** Stats (SPEC §7): this week's review on Sunday, then the charts, calmest first. */
export function StatsScreen() {
  const t = useTranslations("stats");
  const tc = useTranslations("common");
  const { data, status, retry, submitReview } = useStats();
  const streak = useStreak();
  return (
    <>
      <ScreenHeader title={t("title")} subtitle={t("subtitle")} />
      {status === "loading" && (
        <p role="status" className="px-4 text-muted lg:px-6">
          {tc("loading")}
        </p>
      )}
      {status === "error" && (
        <div role="alert" className="mx-4 rounded-xl bg-accent-soft p-3 lg:mx-6">
          <p className="font-bold">{t("error")}</p>
          <Button variant="secondary" className="mt-2" onClick={retry}>
            {tc("retry")}
          </Button>
        </div>
      )}
      {data && <StatsBody data={data} submit={submitReview} streak={streak.view} />}
    </>
  );
}
