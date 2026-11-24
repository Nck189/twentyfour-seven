import { Suspense } from "react";
import { InviteLanding } from "@/components/invite/InviteLanding";

/** An invite link (docs/FRIENDS-DESIGN.md): `/i/<token>`, open to everyone, never indexed. */
export const metadata = { robots: { index: false, follow: false } };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  return <InviteLanding token={(await params).token} />;
}
