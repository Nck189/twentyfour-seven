import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { loadInviteAdmin, loadRetention } from "@/lib/stats/retentionServer";
import { InviteAdmin } from "./InviteAdmin";
import { RetentionTable } from "./RetentionTable";

/** G3: retention dashboard for Minnie (ADMIN_EMAILS only; everyone else gets a 404). */
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Retention />
    </Suspense>
  );
}

async function Retention() {
  await connection();
  const [r, inv] = await Promise.all([loadRetention(new Date()), loadInviteAdmin()]);
  if (!r) notFound();
  return (
    <>
      <RetentionTable cohorts={r.cohorts} users={r.users} />
      {inv && <InviteAdmin on={inv.on} unlimited={inv.unlimited} />}
    </>
  );
}
