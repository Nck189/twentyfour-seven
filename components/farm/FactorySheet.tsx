"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { MachineArt, ProductArt } from "@/components/art/farm/Factory";
import { ProduceArt } from "@/components/art/farm/Animals";
import { CropArt } from "@/components/art/farm/CropArt";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import {
  KPI_WINDOW_DAYS,
  MACHINE_IDS,
  MACHINES,
  recipesFor,
  type MachineId,
  type RecipeInput,
} from "@/content/factory";
import type { FactoryError, useFactory } from "@/lib/factory/useFactory";
import {
  capacity,
  factoryKpi,
  jobMinutes,
  jobState,
  missingInputs,
  progress,
  stockOf,
  takesPremium,
  wouldTake,
  type JobRow,
  type MachineRow,
} from "@/lib/game/factory";
import { sfx } from "@/lib/sound/sfx";

type Factory = ReturnType<typeof useFactory>;

/** Ticks once a second while the sheet is open (countdowns, progress bars). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * The factory (M13, SPEC §9): build machines, queue recipes, collect products and sell them at the
 * market, and read the KPI panel (throughput, utilization, WIP, bottleneck). The server decides
 * every start/ready time, every input taken and every coin.
 */
export function FactorySheet({ factory, onClose }: { factory: Factory; onClose: () => void }) {
  const t = useTranslations("factory");
  const [tab, setTab] = useState<"make" | "kpi">("make");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const now = useNow();
  const d = factory.data;

  /** Runs one action at a time; `fn` returns an error, or null / its own success text. */
  const act = async (fn: () => Promise<FactoryError | { text: string } | null>, ok: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMsg(null);
    const e = await fn();
    busy.current = false;
    setPending(false);
    setMsg(
      typeof e === "string" ? { kind: "error", text: t(`errors.${e}`) } : { kind: "ok", text: e?.text ?? ok },
    );
  };

  return (
    <Sheet title={t("title")} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label={t("title")}>
        {(["make", "kpi"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={`tap min-h-11 rounded-xl font-bold ${tab === k ? "bg-primary text-on-primary" : "bg-surface-2"}`}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>
      {msg && (
        <p
          role={msg.kind === "error" ? "alert" : "status"}
          className={`mb-3 text-sm font-bold ${msg.kind === "error" ? "text-accent" : "text-primary"}`}
        >
          {msg.text}
        </p>
      )}
      {factory.failed && !d && (
        <p role="alert" className="text-sm text-accent">
          {t("errors.load")}{" "}
          <button type="button" className="tap min-h-11 font-bold underline" onClick={factory.reload}>
            {t("retry")}
          </button>
        </p>
      )}
      {!d && !factory.failed && <p className="text-sm text-muted">{t("loading")}</p>}
      {d && tab === "make" && (
        <>
          <p className="mb-2 text-sm font-bold">{t("coins", { n: d.coins })}</p>
          <ul className="flex flex-col gap-3">
            {MACHINE_IDS.map((id) => (
              <MachineCard
                key={id}
                id={id}
                machine={d.machines.find((m) => m.machine_id === id) ?? null}
                jobs={d.jobs.filter((j) => j.machine_id === id && !j.collected_at)}
                factory={factory}
                now={now}
                pending={pending}
                act={act}
              />
            ))}
          </ul>
        </>
      )}
      {d && tab === "kpi" && <KpiPanel machines={d.machines} jobs={d.jobs} now={now} />}
    </Sheet>
  );
}

function MachineCard({
  id,
  machine,
  jobs,
  factory,
  now,
  pending,
  act,
}: {
  id: MachineId;
  machine: MachineRow | null;
  jobs: JobRow[];
  factory: Factory;
  now: Date;
  pending: boolean;
  act: (fn: () => Promise<FactoryError | { text: string } | null>, ok: string) => Promise<void>;
}) {
  const t = useTranslations("factory");
  const products = useTranslations("products");
  const name = t(`machines.${id}`);
  const def = MACHINES[id];
  const coins = factory.data?.coins ?? 0;
  const stock = factory.data?.stock ?? [];
  const working = jobs.some((j) => jobState(j, now) === "running");
  const ready = jobs.filter((j) => jobState(j, now) === "ready").length;
  // A recipe waiting for a second tap because it would use a premium crop (R-M13-2).
  const [confirm, setConfirm] = useState<string | null>(null);

  if (!machine)
    return (
      <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
        <MachineArt id={id} className="h-14 w-14 shrink-0 opacity-70" />
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{name}</span>
          <span className="block text-sm text-muted">{t(`blurb.${id}`)}</span>
        </span>
        <Button
          variant="secondary"
          disabled={pending || coins < def.price}
          aria-label={t("buildAria", { name, n: def.price })}
          onClick={() =>
            act(
              async () => {
                const e = await factory.build(id);
                if (!e) sfx.coin();
                return e;
              },
              t("built", { name }),
            )
          }
        >
          {t("build", { n: def.price })}
        </Button>
      </li>
    );

  const cap = capacity(machine.capacity_level);
  const full = jobs.length >= cap;
  return (
    <li className="rounded-xl bg-surface-2 p-3">
      <section aria-label={name}>
        <div className="mb-2 flex items-center gap-3">
          <MachineArt id={id} working={working} className="h-14 w-14 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">{name}</span>
            <span className="block text-sm text-muted">{t("queue", { n: jobs.length, cap })}</span>
          </span>
          {ready > 0 && (
            <Button
              onClick={() =>
                act(async () => {
                  const n = await factory.collect(id);
                  if (n === null) return "error";
                  // The server's count (a phone clock running fast may show one too early; R-M13-3).
                  if (n > 0) sfx.pop();
                  return { text: n > 0 ? t("collected", { n }) : t("notYet") };
                }, "")
              }
              disabled={pending}
            >
              {t("collect", { n: ready })}
            </Button>
          )}
        </div>

        {jobs.length === 0 ? (
          <p className="mb-2 text-sm text-muted">{t("idle")}</p>
        ) : (
          <ol className="mb-2 flex flex-col gap-1" aria-label={t("queueLabel", { name })}>
            {jobs.map((j) => {
              const st = jobState(j, now);
              const left = Math.max(0, Math.ceil((new Date(j.ready_at).getTime() - now.getTime()) / 60_000));
              return (
                <li key={j.id} className="flex items-center gap-2 text-sm">
                  <ProductArt id={j.recipe_id} className="h-8 w-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{products(j.recipe_id)}</span>
                    <span
                      className="block h-1.5 overflow-hidden rounded-full bg-surface"
                      role="progressbar"
                      aria-label={products(j.recipe_id)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress(j, now) * 100)}
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(progress(j, now) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${st === "ready" ? "font-bold text-primary" : "text-muted"}`}
                  >
                    {st === "ready"
                      ? t("state.ready")
                      : st === "running"
                        ? t("left", { m: left })
                        : t("state.waiting")}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <h4 className="mb-1 text-sm font-bold">{t("recipes")}</h4>
        <ul className="flex flex-col gap-2">
          {recipesFor(id).map((r) => {
            const missing = missingInputs(r, stock);
            const premium = missing.length === 0 && takesPremium(wouldTake(r, stock));
            const asking = confirm === r.id && premium;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-2">
                <ProductArt id={r.id} className="h-10 w-10 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{products(r.id)}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {r.inputs.map((i) => (
                      <InputChip key={"crop" in i ? i.crop : i.produce} input={i} have={stockOf(i, stock)} />
                    ))}
                  </span>
                  <span className="block text-xs text-muted">
                    {t("recipeLine", { m: jobMinutes(r, machine.speed_level), n: r.price })}
                  </span>
                </span>
                <Button
                  variant={asking ? "primary" : "secondary"}
                  disabled={pending || full || missing.length > 0}
                  aria-label={
                    asking
                      ? t("makeAnywayAria", { name: products(r.id) })
                      : t("makeAria", { name: products(r.id) })
                  }
                  onClick={() => {
                    if (premium && !asking) {
                      setConfirm(r.id);
                      return;
                    }
                    setConfirm(null);
                    void act(() => factory.start(id, r.id), t("started", { name: products(r.id) }));
                  }}
                >
                  {asking ? t("makeAnyway") : t("make")}
                </Button>
                {asking && (
                  <p role="alert" className="w-full text-xs font-bold text-accent">
                    {t("premiumWarn")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {full && <p className="mt-1 text-xs font-bold text-accent">{t("errors.full")}</p>}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["speed", "capacity"] as const).map((track) => {
            const lvl = track === "speed" ? machine.speed_level : machine.capacity_level;
            const prices = track === "speed" ? def.speedPrices : def.capacityPrices;
            const price = prices[lvl];
            return (
              <Button
                key={track}
                variant="ghost"
                disabled={pending || price === undefined || coins < price}
                aria-label={t(`upgradeAria.${track}`, { name, level: lvl + 1 })}
                onClick={() =>
                  act(() => factory.upgrade(id, track), t(`upgraded.${track}`, { name, level: lvl + 1 }))
                }
                className="flex-col !items-start text-left"
              >
                <span className="text-xs text-muted">{t(`track.${track}`, { level: lvl + 1 })}</span>
                <span className="text-sm">{price === undefined ? t("max") : t("upgrade", { n: price })}</span>
              </Button>
            );
          })}
        </div>
      </section>
    </li>
  );
}

function InputChip({ input, have }: { input: RecipeInput; have: number }) {
  const crops = useTranslations("crops");
  const produce = useTranslations("produce");
  const t = useTranslations("factory");
  const name = "crop" in input ? crops(input.crop) : produce(input.produce);
  const ok = have >= input.qty;
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? "" : "font-bold text-accent"}`}>
      {"crop" in input ? (
        <CropArt cropId={input.crop} stage={3} status="ready" className="h-5 w-5" />
      ) : (
        <ProduceArt id={input.produce} className="h-5 w-5" />
      )}
      {t("input", { name, have: Math.min(have, 99), qty: input.qty })}
    </span>
  );
}

function KpiPanel({ machines, jobs, now }: { machines: MachineRow[]; jobs: JobRow[]; now: Date }) {
  const t = useTranslations("factory");
  const locale = useLocale();
  const k = factoryKpi(machines, jobs, now);
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (machines.length === 0) return <p className="text-sm text-muted">{t("kpi.noMachines")}</p>;
  return (
    <section aria-label={t("tabs.kpi")}>
      <p className="mb-3 text-xs text-muted">{t("kpi.window", { n: KPI_WINDOW_DAYS })}</p>
      <dl className="mb-4 grid grid-cols-2 gap-2">
        {[
          [t("kpi.throughput"), num.format(k.throughputPerDay)],
          [t("kpi.wip"), String(k.wip)],
          [t("kpi.ready"), String(k.readyToCollect)],
          [
            t("kpi.lead"),
            k.leadMin === null ? "–" : t("kpi.leadValue", { lead: k.leadMin, work: k.processMin ?? 0 }),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-lg font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>
      <h4 className="mb-2 text-sm font-bold">{t("kpi.util")}</h4>
      <ul className="mb-4 flex flex-col gap-2">
        {k.machines.map((m) => (
          <li key={m.machine} className="flex items-center gap-2">
            <MachineArt id={m.machine} className="h-8 w-8 shrink-0" />
            <span className="w-24 shrink-0 text-sm">{t(`machines.${m.machine}`)}</span>
            <span
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
              role="meter"
              aria-label={t("kpi.utilAria", { name: t(`machines.${m.machine}`) })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(m.utilization * 100)}
            >
              <span
                className={`block h-full rounded-full ${k.bottleneck === m.machine ? "bg-accent" : "bg-primary"}`}
                style={{ width: `${Math.round(m.utilization * 100)}%` }}
              />
            </span>
            <span className="w-11 shrink-0 text-right text-sm font-bold">{pct.format(m.utilization)}</span>
          </li>
        ))}
      </ul>
      {k.bottleneck ? (
        <p className="rounded-xl bg-surface-2 p-3 text-sm">
          <span className="block font-extrabold">
            {t("kpi.bottleneck", { name: t(`machines.${k.bottleneck}`) })}
          </span>
          {t("kpi.bottleneckHint")}
        </p>
      ) : (
        <p className="text-sm text-muted">{t("kpi.noData")}</p>
      )}
    </section>
  );
}
