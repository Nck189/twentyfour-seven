import { Landing } from "@/components/landing/Landing";

/** The front door. Signed-in visitors are sent to Today by the proxy (lib/supabase/proxy-session.ts). */
export default function Page() {
  return <Landing />;
}
