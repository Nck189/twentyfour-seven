import { BarsIcon, CalendarIcon, DotsIcon, SproutIcon, SunIcon } from "./TabIcons";

export const NAV_ITEMS = [
  { href: "/today", key: "today", Icon: SunIcon },
  { href: "/plan", key: "plan", Icon: CalendarIcon },
  { href: "/farm", key: "farm", Icon: SproutIcon },
  { href: "/stats", key: "stats", Icon: BarsIcon },
  { href: "/more", key: "more", Icon: DotsIcon },
] as const;
