"use client";

import { useTranslations } from "next-intl";
import { BLOCKS_WITHOUT_DEFAULT_FIRST10, type BlockKey } from "@/content/blocks";
import { NONE, parseSuggestion } from "@/lib/onboarding";

/**
 * Block display name + first-10 text: "" → none (null); "@s:…" → built-in suggestion; own text;
 * null → the built-in default where there is one.
 */
export function useBlockText() {
  const t = useTranslations("blocks");
  return {
    name: (key: BlockKey) => t(`name.${key}`),
    first10: (key: BlockKey, custom: string | null): string | null => {
      if (custom === NONE) return null;
      if (custom) {
        const s = parseSuggestion(custom);
        return s ? t(`suggest.${s.key}.${s.n}` as Parameters<typeof t>[0]) : custom;
      }
      if (BLOCKS_WITHOUT_DEFAULT_FIRST10.includes(key)) return null;
      return t(`first10.${key as Exclude<BlockKey, "focus" | "free">}`);
    },
  };
}
