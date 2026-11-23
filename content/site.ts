/**
 * The app's public address, printed on shared pictures and used for link previews. One place to
 * change if the app moves to its own domain (`NEXT_PUBLIC_SITE_URL`, e.g. "https://example.com").
 */
const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
export const SITE_HOST = fromEnv || "twentyfour-seven.vercel.app";

/** Where a visitor came from (a shared picture, the free-times page), kept on the link. */
export type LinkSource = "week" | "share" | "moment" | "free";

export const sitePath = (path: string, from?: LinkSource) => (from ? `${path}?from=${from}` : path);
export const siteUrl = (path: string, from?: LinkSource) => `https://${SITE_HOST}${sitePath(path, from)}`;
