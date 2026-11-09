"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { TicketArt } from "@/components/art/Ticket";
import { StreakCalendar } from "@/components/streak/StreakChip";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { BLOCK_KEYS } from "@/content/blocks";
import { dayOee } from "@/lib/game/outcome";
import {
  heatmap,
  homeVsOut,
  imrChart,
  pareto,
  sleepRegularity,
  splitWeekend,
  weekSummary,
} from "@/lib/stats/stats";
import { useStats, type StatsData } from "@/lib/stats/useStats";
import { sfx } from "@/lib/sound/sfx";
import { useStreak, type StreakView } from "@/lib/streak/useStreak";
import { addDays } from "@/lib/time";

const hhmm = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const shortDate = (d: string) => d.slice(8, 10);

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
    () => (week ? weekSummary(data.days.filter((d) => d.date >= week && d.date <= addDays(week, 6))) : null),
    [data.days, week],
  );
  if (!data.review || !week || !summary) return null;
  if (data.review.done && state === "idle")
    return (
      <Card title={t("review.title")}>
        <p className="text-sm text-muted">{t("review.doneAlready")}</p>
      </Card>
    );
  const ready = keep.trim() && problem.trim() && tryNext.trim();
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
      <p className="mb-2 text-sm text-muted">{t("review.intro")}</p>
      <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("review.oee")}</dt>
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

/** Wake-time I-MR chart (SPEC §7): mean ± 3σ, weekday vs weekend, points outside flagged. */
function WakeChart({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const [part, setPart] = useState<"weekday" | "weekend">("weekday");
  const chart = imrChart(splitWeekend(data.wakes)[part]);
  const out = chart?.points.filter((p) => p.out).length ?? 0;
  return (
    <Card title={t("wake.title")}>
      <div role="radiogroup" aria-label={t("wake.title")} className="mb-2 grid grid-cols-2 gap-2">
        {(["weekday", "weekend"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={part === k}
            onClick={() => setPart(k)}
            className={`tap min-h-11 rounded-xl text-sm font-bold ${part === k ? "bg-primary text-on-primary" : "bg-surface-2"}`}
          >
            {t(`wake.${k}`)}
          </button>
        ))}
      </div>
      {chart ? (
        <>
          <p className="mb-1 text-sm">
            {t("wake.mean", { time: hhmm(chart.mean), sd: Math.round(chart.sigma) })}
            {out > 0 && <span className="text-warn"> · {t("wake.out", { n: out })}</span>}
          </p>
          <div className="h-44" role="img" aria-label={t("wake.aria", { time: hhmm(chart.mean), n: out })}>
            <ResponsiveContainer>
              <LineChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="var(--ui-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} />
                <YAxis
                  domain={[
                    (min: number) => Math.min(min, chart.lcl) - 10,
                    (max: number) => Math.max(max, chart.ucl) + 10,
                  ]}
                  tickFormatter={hhmm}
                  tick={AXIS}
                  width={44}
                />
                <ReferenceLine y={chart.mean} stroke="var(--ui-primary)" strokeDasharray="4 4" />
                <ReferenceLine y={chart.ucl} stroke="var(--ui-warn)" strokeDasharray="2 4" />
                <ReferenceLine y={chart.lcl} stroke="var(--ui-warn)" strokeDasharray="2 4" />
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
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function OeeBars({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const rows = data.days.slice(-14).map((d) => ({ date: d.date, oee: dayOee(d)?.oee ?? null }));
  const known = rows.filter((r) => r.oee !== null);
  const avg = known.length ? known.reduce((a, r) => a + r.oee!, 0) / known.length : null;
  return (
    <Card title={t("oee.title")}>
      {known.length ? (
        <>
          <p className="mb-1 text-sm">{t("oee.avg", { pct: pct(avg) })}</p>
          <div className="h-36" role="img" aria-label={t("oee.aria", { pct: pct(avg), n: known.length })}>
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="var(--ui-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} />
                <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${v * 100}`} tick={AXIS} width={36} />
                <ReferenceLine y={0.8} stroke="var(--ui-primary)" strokeDasharray="4 4" />
                <Bar dataKey="oee" fill="var(--ui-primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted">{t("oee.help")}</p>
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
  return (
    <Card title={t("sleep.title")}>
      {r.wakeSd === null && r.bedSd === null ? (
        <Empty />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 p-2">
              <dt className="text-xs text-muted">{t("sleep.bed")}</dt>
              <dd className="text-xl font-extrabold">
                {r.bedSd === null ? "–" : t("sleep.min", { n: Math.round(r.bedSd) })}
              </dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-2">
              <dt className="text-xs text-muted">{t("sleep.wake")}</dt>
              <dd className="text-xl font-extrabold">
                {r.wakeSd === null ? "–" : t("sleep.min", { n: Math.round(r.wakeSd) })}
              </dd>
            </div>
          </dl>
          {drift && <p className="mt-2 text-sm">{drift}</p>}
          <p className="mt-1 text-xs text-muted">{t("sleep.help")}</p>
        </>
      )}
    </Card>
  );
}

function Heat({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const blocks = useTranslations("blocks");
  const h = heatmap(data.days);
  const days = [1, 2, 3, 4, 5, 6, 7] as const;
  const any = BLOCK_KEYS.some((b) => days.some((w) => h[b][w]!.judged > 0));
  return (
    <Card title={t("heat.title")}>
      {any ? (
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
            {BLOCK_KEYS.map((b) => (
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
                      style={{
                        background:
                          rate === null
                            ? "var(--ui-surface-2)"
                            : `color-mix(in srgb, var(--ui-primary) ${Math.round(15 + rate * 85)}%, var(--ui-surface-2))`,
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function Pareto({ data }: { data: StatsData }) {
  const t = useTranslations("stats");
  const reasons = useTranslations("night.reasons");
  const rows = pareto(data.days).map((r) => ({
    ...r,
    label: ["sleepy", "phone", "interruption", "social", "sick", "other"].includes(r.reason)
      ? reasons(r.reason as "other")
      : r.reason,
  }));
  return (
    <Card title={t("pareto.title")}>
      {rows.length ? (
        <>
          <p className="mb-1 text-sm">
            {t("pareto.top", { reason: rows[0]!.label, pct: pct(rows[0]!.share) })}
          </p>
          <div
            className="h-44"
            role="img"
            aria-label={t("pareto.aria", { reason: rows[0]!.label, pct: pct(rows[0]!.share) })}
          >
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--ui-border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} interval={0} />
                <YAxis yAxisId="n" allowDecimals={false} tick={AXIS} width={36} />
                <YAxis yAxisId="c" orientation="right" domain={[0, 1]} hide />
                <Bar
                  yAxisId="n"
                  dataKey="count"
                  fill="var(--art-pink)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="c"
                  dataKey="cumulative"
                  stroke="var(--ui-primary)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
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
      {(["home", "out"] as const).map((k) => (
        <div key={k} className="mb-2">
          <div className="flex justify-between text-sm">
            <span className="font-bold">{t(`place.${k}`)}</span>
            <span>{r[k].rate === null ? "–" : t("place.rate", { pct: pct(r[k].rate), n: r[k].logged })}</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((r[k].rate ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}

/** The Stats cards for loaded data (also used by the /dev/stats preview). */
export function StatsBody({
  data,
  submit,
  streak,
}: {
  data: StatsData;
  submit: ReturnType<typeof useStats>["submitReview"];
  streak: StreakView | null;
}) {
  const t = useTranslations("stats");
  return (
    <div className="pb-6">
      <WeeklyReview data={data} submit={submit} />
      <OeeBars data={data} />
      <WakeChart data={data} />
      <Regularity data={data} />
      {streak && (
        <Card title={t("streak")}>
          <StreakCalendar view={streak} />
        </Card>
      )}
      <Heat data={data} />
      <Pareto data={data} />
      <HomeOut data={data} />
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
