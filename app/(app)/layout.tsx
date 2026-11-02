import { ProfileSync } from "@/components/providers/ProfileSync";
import { AppShell } from "@/components/shell/AppShell";
import { SidePanel } from "@/components/shell/SidePanel";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ProfileSync />
      <AppShell side={<SidePanel />}>{children}</AppShell>
    </>
  );
}
