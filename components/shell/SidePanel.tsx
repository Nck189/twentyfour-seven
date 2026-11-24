"use client";

import { usePathname } from "next/navigation";
import { FarmScreen } from "@/components/farm/FarmScreen";
import { PlanScreen } from "@/components/plan/PlanScreen";

/**
 * iPad/Mac right-hand panel: the farm (compact), or, when the main column is the farm, Plan with
 * the backlog (it was an M0 "coming soon" placeholder until 2026-11-24). Plan's own day cards,
 * task sheet and Move to… work here as on the Plan tab.
 */
export function SidePanel() {
  const pathname = usePathname();
  return pathname.startsWith("/farm") ? <PlanScreen aside /> : <FarmScreen compact />;
}
