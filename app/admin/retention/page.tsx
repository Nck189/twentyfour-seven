import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { loadRetention } from "@/lib/stats/retentionServer";
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
  const r = await loadRetention(new Date());
  if (!r) notFound();
  return <RetentionTable cohorts={r.cohorts} users={r.users} />;
}
