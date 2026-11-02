"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const v = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev");
    navigator.serviceWorker.register(`/sw.js?v=${v}`, { scope: "/", updateViaCache: "none" }).catch(() => {
      // Non-fatal: the app works without the service worker.
    });
  }, []);
  return null;
}
