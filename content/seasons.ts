/**
 * Seasons (SPEC §8.8): each real calendar month is a season with its own banner; festival months
 * also sell one limited decor (only that month, checked by the server in `buy_decor`). The last
 * days of a month and the first of the next show the harvest festival (the monthly review).
 * Labels come from i18n `seasons.<id>`. Mirrored in SQL (M9 migration) with a test.
 */
import type { ToneName } from "@/components/art/farm/parts";
import type { FestivalDecorId } from "./decor";

export const SEASON_IDS = [
  "new_year",
  "lunar_new_year",
  "blossom",
  "songkran",
  "first_rain",
  "monsoon",
  "green_rice",
  "mothers_day",
  "harvest_moon",
  "cool_breeze",
  "loy_krathong",
  "winter_lights",
] as const;
export type SeasonId = (typeof SEASON_IDS)[number];
export type Season = { id: SeasonId; tone: ToneName; festival?: FestivalDecorId };

/** Index 0 = January. */
export const SEASONS: readonly Season[] = [
  { id: "new_year", tone: "yellow", festival: "fireworks" },
  { id: "lunar_new_year", tone: "red", festival: "red_lantern" },
  { id: "blossom", tone: "pink" },
  { id: "songkran", tone: "blue", festival: "water_bowl" },
  { id: "first_rain", tone: "leaf" },
  { id: "monsoon", tone: "blue" },
  { id: "green_rice", tone: "leaf" },
  { id: "mothers_day", tone: "silver", festival: "jasmine" },
  { id: "harvest_moon", tone: "orange" },
  { id: "cool_breeze", tone: "purple" },
  { id: "loy_krathong", tone: "yellow", festival: "krathong" },
  { id: "winter_lights", tone: "silver", festival: "star_tree" },
];

/** The harvest festival shows this many days before a month ends and after the next begins. */
export const FESTIVAL_DAYS = 3;

/** The festival month (1–12) of a festival decor item. */
export const FESTIVAL_MONTH: Record<FestivalDecorId, number> = Object.fromEntries(
  SEASONS.flatMap((s, i) => (s.festival ? [[s.festival, i + 1]] : [])),
) as Record<FestivalDecorId, number>;

/** The season of a local date (YYYY-MM-DD). */
export const seasonOf = (date: string): Season => SEASONS[Number(date.slice(5, 7)) - 1]!;
