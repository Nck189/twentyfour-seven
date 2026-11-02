"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen kind="error" onRetry={retry} />;
}
