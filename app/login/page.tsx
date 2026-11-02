import { Suspense } from "react";
import { AppMark } from "@/components/art/AppMark";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="safe-top safe-bottom flex min-h-dvh flex-col items-center justify-center px-6">
      <Suspense fallback={<AppMark className="h-20 w-20" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
