/**
 * More in four groups (review fix D): which card lives on which sub-page. Pure, so the old
 * `/more#<card>` links can be sent to the right page and the mapping is unit-tested.
 */
export const MORE_GROUPS = ["setup", "sharing", "preferences", "account"] as const;
export type MoreGroup = (typeof MORE_GROUPS)[number];

/** Card anchors (the `id` each card already has), by group, in page order. */
export const GROUP_CARDS: Record<MoreGroup, readonly string[]> = {
  setup: ["setup-links", "exercise"],
  sharing: ["share", "calendar"],
  preferences: ["language", "theme", "sound", "notifications", "tips", "cafe"],
  account: ["install", "privacy", "export", "account"],
};

export const isMoreGroup = (v: unknown): v is MoreGroup =>
  typeof v === "string" && (MORE_GROUPS as readonly string[]).includes(v);

/** The group a card is on, or null for an unknown anchor. */
export function groupOfCard(id: string): MoreGroup | null {
  for (const g of MORE_GROUPS) if (GROUP_CARDS[g].includes(id)) return g;
  return null;
}

/**
 * Where an old `/more#<id>` link goes now: `/more/<group>#<id>`, or null to stay on `/more`
 * (no hash, `#setup` — the setup card is still there — or an anchor that no longer exists).
 */
export function hashRedirect(hash: string): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const g = id ? groupOfCard(id) : null;
  return g ? `/more/${g}#${id}` : null;
}
