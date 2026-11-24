/**
 * The invite token a person arrived with (docs/FRIENDS-DESIGN.md): kept in this browser from the
 * invite page until the account exists and claims it. Storage can fail (private mode); then the
 * gate's "paste your invite link" still works.
 */
export const INVITE_KEY = "247-invite";

/** The 48-hex token in a pasted link or a bare token, else null. */
export function tokenFrom(text: string): string | null {
  return /(?:^|\/i\/|\b)([0-9a-f]{48})(?:\b|$)/i.exec(text.trim())?.[1]?.toLowerCase() ?? null;
}

export function saveInvite(token: string): void {
  try {
    localStorage.setItem(INVITE_KEY, token);
  } catch {
    /* storage blocked */
  }
}

export function loadInvite(): string | null {
  try {
    return localStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearInvite(): void {
  try {
    localStorage.removeItem(INVITE_KEY);
  } catch {
    /* storage blocked */
  }
}
