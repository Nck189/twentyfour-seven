/**
 * Dev-only Farm preview (QA_QC G3): the real Farm UI on a seeded sample week, so the screen can
 * be checked and screenshotted without a database. 404 in production.
 */
import { notFound } from "next/navigation";
import { FarmPreview } from "./FarmPreview";

export default async function Page({ searchParams }: { searchParams: Promise<{ sky?: string }> }) {
  if (process.env.NODE_ENV === "production" && !process.env.ART_SHEET) notFound();
  const { sky } = await searchParams;
  return <FarmPreview sky={sky === "night" || sky === "dusk" || sky === "sunrise" ? sky : "day"} />;
}
