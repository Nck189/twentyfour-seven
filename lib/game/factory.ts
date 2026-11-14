/**
 * Factory rules (M13), pure. The server runs the same queue rules in SQL with its own clock
 * (`start_job`); the client uses these for countdowns, "can I make this?" and the KPI panel.
 */
import { PRODUCE_PRICE, SELL_BASE } from "@/content/economy";
import { CROPS } from "@/content/crops";
import {
  KPI_WINDOW_DAYS,
  MACHINE_IDS,
  QUEUE_CAPACITY,
  RECIPES,
  SPEED_FACTOR,
  type MachineId,
  type ProductId,
  type Recipe,
  type RecipeInput,
} from "@/content/factory";

export type MachineRow = {
  machine_id: MachineId;
  speed_level: number;
  capacity_level: number;
  bought_at: string;
};
export type JobRow = {
  id: string;
  machine_id: MachineId;
  recipe_id: ProductId;
  created_at: string;
  start_at: string;
  ready_at: string;
  collected_at: string | null;
};
export type JobState = "waiting" | "running" | "ready" | "collected";
export type Stock = { item_id: string; qty: number }[];

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const t = (iso: string) => new Date(iso).getTime();
const clampLevel = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(n)));

/** Minutes one job of this recipe takes at a speed level. */
export function jobMinutes(recipe: Recipe, speedLevel: number): number {
  return Math.round(recipe.minutes * SPEED_FACTOR[clampLevel(speedLevel, SPEED_FACTOR.length - 1)]);
}

/** Jobs a machine can hold at a capacity level (running + waiting + ready to collect). */
export function capacity(capacityLevel: number): number {
  return QUEUE_CAPACITY[clampLevel(capacityLevel, QUEUE_CAPACITY.length - 1)];
}

/** One machine works on one job at a time: a new job starts when the last one ends (or now). */
export function nextStart(machineJobs: readonly JobRow[], now: Date): Date {
  const last = Math.max(now.getTime(), ...machineJobs.map((j) => t(j.ready_at)));
  return new Date(last);
}

export function jobState(job: JobRow, now: Date): JobState {
  if (job.collected_at) return "collected";
  if (t(job.ready_at) <= now.getTime()) return "ready";
  return t(job.start_at) <= now.getTime() ? "running" : "waiting";
}

/** 0..1 of the running job; 0 waiting, 1 ready. */
export function progress(job: JobRow, now: Date): number {
  const s = t(job.start_at);
  const r = t(job.ready_at);
  if (now.getTime() <= s) return 0;
  if (now.getTime() >= r || r <= s) return 1;
  return (now.getTime() - s) / (r - s);
}

/** Jobs still on the machine (not collected) count against its capacity. */
export function hasRoom(machine: MachineRow, machineJobs: readonly JobRow[]): boolean {
  return machineJobs.filter((j) => !j.collected_at).length < capacity(machine.capacity_level);
}

const inputKey = (i: RecipeInput) => ("crop" in i ? `crop:${i.crop}` : `produce:${i.produce}`);

/** How many of an input are in stock (a crop counts at any quality). */
export function stockOf(input: RecipeInput, stock: Stock): number {
  const key = inputKey(input);
  return stock
    .filter((s) => s.item_id === key || ("crop" in input && s.item_id.startsWith(`${key}:`)))
    .reduce((n, s) => n + Math.max(0, s.qty), 0);
}

/** Inputs that are short, with how many are missing (empty: the recipe can start). */
export function missingInputs(recipe: Recipe, stock: Stock): { input: RecipeInput; missing: number }[] {
  return recipe.inputs
    .map((input) => ({ input, missing: Math.max(0, input.qty - stockOf(input, stock)) }))
    .filter((m) => m.missing > 0);
}

/** The inputs' market value at normal quality, no bonuses (for the make-or-sell hint). */
export function inputValue(recipe: Recipe): number {
  return recipe.inputs.reduce(
    (sum, i) => sum + i.qty * ("crop" in i ? SELL_BASE[CROPS[i.crop].rarity] : PRODUCE_PRICE[i.produce]),
    0,
  );
}

export const productItem = (id: ProductId) => `product:${id}`;

export type MachineKpi = {
  machine: MachineId;
  /** Busy share of the time it was owned in the window, 0..1. */
  utilization: number;
  /** Jobs not finished yet (running + waiting). */
  wip: number;
  /** Finished in the window. */
  done: number;
};

export type FactoryKpi = {
  /** Products finished per day over the window (or since the first machine, if newer). */
  throughputPerDay: number;
  /** Jobs not finished yet, all machines. */
  wip: number;
  /** Finished, waiting to be collected. */
  readyToCollect: number;
  /** Mean minutes from "start" tapped to ready, and of that, minutes spent working (no queue). */
  leadMin: number | null;
  processMin: number | null;
  machines: MachineKpi[];
  /** The most-utilized machine (more WIP breaks a tie); null with no work in the window. */
  bottleneck: MachineId | null;
};

const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Throughput, utilization, WIP and the bottleneck over the last KPI_WINDOW_DAYS days. */
export function factoryKpi(
  machines: readonly MachineRow[],
  jobs: readonly JobRow[],
  now: Date,
  windowDays = KPI_WINDOW_DAYS,
): FactoryKpi {
  const end = now.getTime();
  const w0 = end - windowDays * DAY;
  const per: MachineKpi[] = MACHINE_IDS.filter((id) => machines.some((m) => m.machine_id === id)).map(
    (id) => {
      const m = machines.find((x) => x.machine_id === id)!;
      const from = Math.max(w0, t(m.bought_at));
      const span = Math.max(0, end - from);
      const mine = jobs.filter((j) => j.machine_id === id);
      const busy = mine.reduce((s, j) => s + overlap(t(j.start_at), t(j.ready_at), from, end), 0);
      return {
        machine: id,
        utilization: span > 0 ? Math.min(1, busy / span) : 0,
        wip: mine.filter((j) => t(j.ready_at) > end).length,
        done: mine.filter((j) => t(j.ready_at) > w0 && t(j.ready_at) <= end).length,
      };
    },
  );
  const finished = jobs.filter((j) => t(j.ready_at) > w0 && t(j.ready_at) <= end);
  const first = Math.min(...machines.map((m) => t(m.bought_at)), end);
  const days = Math.max(1, (end - Math.max(w0, first)) / DAY);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const leadMin = mean(finished.map((j) => (t(j.ready_at) - t(j.created_at)) / MIN));
  const processMin = mean(finished.map((j) => (t(j.ready_at) - t(j.start_at)) / MIN));
  const ranked = per
    .filter((m) => m.utilization > 0 || m.wip > 0)
    .sort((a, b) => b.utilization - a.utilization || b.wip - a.wip);
  return {
    throughputPerDay: finished.length / days,
    wip: per.reduce((s, m) => s + m.wip, 0),
    readyToCollect: jobs.filter((j) => !j.collected_at && t(j.ready_at) <= end).length,
    leadMin: leadMin === null ? null : Math.round(leadMin),
    processMin: processMin === null ? null : Math.round(processMin),
    machines: per,
    bottleneck: ranked[0]?.machine ?? null,
  };
}

export { RECIPES };
