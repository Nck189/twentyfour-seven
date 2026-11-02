import { AppShell } from "@/components/shell/AppShell";
import { SidePanel } from "@/components/shell/SidePanel";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell side={<SidePanel />}>{children}</AppShell>;
}
