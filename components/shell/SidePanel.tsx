"use client";

import { usePathname } from "next/navigation";
import { FarmScreen } from "@/components/farm/FarmScreen";
import { Placeholder } from "@/components/ui/Placeholder";

/** iPad/Mac right-hand panel: the farm (compact), or the backlog when the main column is the farm. */
export function SidePanel() {
  const pathname = usePathname();
  return pathname.startsWith("/farm") ? <Placeholder section="backlog" asAside /> : <FarmScreen compact />;
}
