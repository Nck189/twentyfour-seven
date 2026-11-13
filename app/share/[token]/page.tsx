import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ShareView } from "@/components/share/ShareView";
import { loadShare } from "@/lib/share/server";

/**
 * Someone's free times (M12, SPEC §9): `/share/<secret>`, no login. Free/busy is computed here on
 * the server (lib/share/server.ts); the browser only ever gets the free intervals. An unknown link
 * shows not-found (noindex).
 */
export const metadata = { robots: { index: false, follow: false } };

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <Share params={params} />
    </Suspense>
  );
}

async function Share({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const token = (await params).token;
  const share = await loadShare(token, new Date());
  if (!share) notFound();
  const days = share.days.map((d) => ({
    date: d.date,
    free: d.free.map((i) => ({ start: i.start.toISOString(), end: i.end.toISOString() })),
  }));
  return <ShareView token={token} name={share.name} timezone={share.timezone} days={days} />;
}
