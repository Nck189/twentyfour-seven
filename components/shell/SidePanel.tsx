"use client";

import { usePathname } from "next/navigation";
import { Placeholder } from "@/components/ui/Placeholder";

/** iPad/Mac right-hand panel: the farm, or the backlog when the main column already shows the farm. */
export function SidePanel() {
  const pathname = usePathname();
  return <Placeholder section={pathname.startsWith("/farm") ? "backlog" : "farm"} asAside />;
}
