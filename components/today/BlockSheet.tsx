"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

/** The sheets open now, oldest first: only the last one answers Escape. */
const OPEN_SHEETS: object[] = [];

/** Bottom sheet (phone) / centered panel (iPad/Mac) with a visible close button and Escape. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  const closeRef = useRef<HTMLButtonElement>(null);
  // Parents pass a new onClose on every render: keep the latest without re-running the effect,
  // so focus moves to Close once (on open), never mid-typing (it closed the iPhone keyboard).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    // Sheets can open over sheets (a buy confirm over the factory): only the top one answers
    // Escape, and focus goes back to what opened it when it closes (G7 G-S3-3).
    const opener = document.activeElement as HTMLElement | null;
    const me = {};
    OPEN_SHEETS.push(me);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && OPEN_SHEETS[OPEN_SHEETS.length - 1] === me) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      OPEN_SHEETS.splice(OPEN_SHEETS.indexOf(me), 1);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      {/* Backdrop: tap to close; hidden from assistive tech (the visible Close button is the accessible one). */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="safe-bottom relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-lg)] bg-surface p-4 md:rounded-[var(--radius-lg)]"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="tap min-h-11 rounded-xl bg-surface-2 px-4 font-bold"
          >
            {tc("close")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
