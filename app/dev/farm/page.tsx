/**
 * Dev-only Farm preview (QA_QC G3): the real Farm UI on a seeded sample week, so the screen can
 * be checked and screenshotted without a database (?sky=night|dusk|sunrise). 404 in production.
 */
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FarmPreview } from "./FarmPreview";

export default function Page() {
  if (process.env.NODE_ENV === "production" && !process.env.ART_SHEET) notFound();
  return (
    <Suspense>
      <FarmPreview />
    </Suspense>
  );
}
