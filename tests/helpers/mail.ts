import { MAILPIT_URL } from "./env";

/** Reads the latest sign-in link sent to `email` from local Mailpit (as a user would copy it). */
export async function latestSignInLink(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: { ID: string }[] };
      if (messages?.length) {
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json()) as {
          Text: string;
        };
        const match = msg.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/);
        if (match) return match[0].replace(/[)\s]+$/, "");
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email for ${email}`);
}
