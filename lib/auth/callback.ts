/**
 * Why a sign-in that came back to /auth/callback didn't finish, from its query (pure):
 * - "cancelled": the person backed out of Google's screen;
 * - "provider": Google or Supabase reported another problem;
 * - "link": an email link that has expired or was already used.
 */
export type CallbackFailure = "cancelled" | "provider" | "link";

export function callbackFailure(params: URLSearchParams): CallbackFailure {
  const error = params.get("error");
  if (error === "access_denied") return "cancelled";
  return error ? "provider" : "link";
}
