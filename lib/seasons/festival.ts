import { FESTIVAL_DAYS } from "@/content/seasons";
import { addDays } from "@/lib/time";

/**
 * Which month's harvest festival shows on `today` (YYYY-MM-DD), or null: the last FESTIVAL_DAYS
 * days of a month show that month; the first FESTIVAL_DAYS days of the next show the one just ended.
 */
export function festivalMonth(today: string): string | null {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  if (day <= FESTIVAL_DAYS) return addDays(`${month}-01`, -1).slice(0, 7);
  if (addDays(today, FESTIVAL_DAYS).slice(0, 7) !== month) return month;
  return null;
}

/** First and last day of a month "YYYY-MM". */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const next = addDays(addDays(from, 31).slice(0, 7) + "-01", 0);
  return { from, to: addDays(next, -1) };
}
