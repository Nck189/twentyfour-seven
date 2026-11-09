/**
 * Dev-only Stats preview (QA_QC G3): the real Stats cards on a seeded 4-week sample, so the
 * screen can be checked and screenshotted without a database (?review=open|done|none). 404 in
 * production.
 */
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatsPreview } from "./StatsPreview";

export default function Page() {
  if (process.env.NODE_ENV === "production" && !process.env.ART_SHEET) notFound();
  return (
    <Suspense>
      <StatsPreview />
    </Suspense>
  );
}
