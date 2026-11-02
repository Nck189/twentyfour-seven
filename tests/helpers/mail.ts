import { MAILPIT_URL } from "./env";

/** Reads the latest sign-in code sent to `email` from local Mailpit. */
export async function latestCode(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: { ID: string }[] };
      if (messages?.length) {
        const msg = await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json();
        const match =
          String(msg.HTML ?? msg.Text).match(/>(\d{6})</) ?? String(msg.Text).match(/\b(\d{6})\b/);
        if (match) return match[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email for ${email}`);
}
