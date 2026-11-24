"use client";

import { usePathname } from "next/navigation";
import { SideBacklog } from "@/components/backlog/SideBacklog";
import { FarmScreen } from "@/components/farm/FarmScreen";

/** iPad/Mac right-hand panel: the farm (compact), or the backlog when the main column is the farm. */
export function SidePanel() {
  const pathname = usePathname();
  return pathname.startsWith("/farm") ? <SideBacklog /> : <FarmScreen compact />;
}
