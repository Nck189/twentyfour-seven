import { ProfileSync } from "@/components/providers/ProfileSync";
import { QuietClock } from "@/components/providers/QuietClock";
import { AppShell } from "@/components/shell/AppShell";
import { SidePanel } from "@/components/shell/SidePanel";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ProfileSync />
      <QuietClock />
      <AppShell side={<SidePanel />}>{children}</AppShell>
    </>
  );
}
