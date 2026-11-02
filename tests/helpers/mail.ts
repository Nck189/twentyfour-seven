import { MAILPIT_URL } from "./env";

/** The latest email's plain text for `email` in local Mailpit, or null if none yet. */
async function latestText(email: string): Promise<string | null> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  if (!res.ok) return null;
  const { messages } = (await res.json()) as { messages: { ID: string }[] };
  if (!messages?.length) return null;
  const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json()) as {
    Text: string;
  };
  return msg.Text;
}

/** Reads the 6-digit sign-in code sent to `email` (the email carries the code only, no link). */
export async function latestSignInCode(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const code = (await latestText(email))?.match(/\b\d{6,10}\b/)?.[0];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email for ${email}`);
}

/** The latest email's text, for checks on what the email says (and doesn't). */
export async function latestSignInText(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await latestText(email);
    if (text) return text;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email for ${email}`);
}
