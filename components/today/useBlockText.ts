"use client";

import { useTranslations } from "next-intl";
import { BLOCKS_WITHOUT_DEFAULT_FIRST10, type BlockKey } from "@/content/blocks";

/** Block display name + first-10 text (user's own text, else the i18n default, else null). */
export function useBlockText() {
  const t = useTranslations("blocks");
  return {
    name: (key: BlockKey) => t(`name.${key}`),
    first10: (key: BlockKey, custom: string | null): string | null => {
      if (custom) return custom;
      if (BLOCKS_WITHOUT_DEFAULT_FIRST10.includes(key)) return null;
      return t(`first10.${key as Exclude<BlockKey, "focus" | "free">}`);
    },
  };
}
