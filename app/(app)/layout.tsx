import { ProfileSync } from "@/components/providers/ProfileSync";
import { QuietClock } from "@/components/providers/QuietClock";
import { InviteGate } from "@/components/invite/InviteGate";
import { AppShell } from "@/components/shell/AppShell";
import { SidePanel } from "@/components/shell/SidePanel";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ProfileSync />
      <QuietClock />
      <InviteGate>
        <AppShell side={<SidePanel />}>{children}</AppShell>
      </InviteGate>
    </>
  );
}
