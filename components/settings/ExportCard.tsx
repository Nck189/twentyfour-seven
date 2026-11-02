"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { localDate } from "@/lib/time";
import { getSupabase } from "@/lib/supabase/client";
import { buildExportBundle, bundleToCsvZip, bundleToJson } from "@/lib/export/buildExport";
import { logEvent } from "@/lib/db/events";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportCard() {
  const t = useTranslations("export");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");

  async function run(format: "json" | "csv") {
    setStatus("working");
    try {
      const bundle = await buildExportBundle(getSupabase());
      const stamp = localDate(new Date());
      if (format === "json") download(bundleToJson(bundle), `24-7-export-${stamp}.json`);
      else download(bundleToCsvZip(bundle), `24-7-export-${stamp}.zip`);
      await logEvent("export", { format });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-2 text-lg font-bold">{t("title")}</h2>
      <p className="mb-3 text-muted">{t("description")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => run("json")} disabled={status === "working"}>
          {t("json")}
        </Button>
        <Button variant="secondary" onClick={() => run("csv")} disabled={status === "working"}>
          {t("csv")}
        </Button>
      </div>
      <p aria-live="polite" className={`mt-2 min-h-6 ${status === "error" ? "text-accent" : "text-muted"}`}>
        {status === "working"
          ? t("working")
          : status === "done"
            ? t("done")
            : status === "error"
              ? t("error")
              : ""}
      </p>
    </section>
  );
}
