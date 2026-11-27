/** The name friends see on an invite (More → Account). The server also caps it at 30 when shown. */
export const NAME_MAX = 30;

/** Trimmed, single-spaced, no control characters, at most NAME_MAX characters; blank → null. */
export function cleanName(raw: string): string | null {
  const s = raw
    // Invisible control characters go; tabs and line breaks count as spaces.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  return Array.from(s).slice(0, NAME_MAX).join("").trim();
}
