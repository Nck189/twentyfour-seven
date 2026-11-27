"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { makeMyInvitesUnlimited, setInviteOnly } from "./actions";

/** Admin-only (Minnie): the invite-only switch and her unlimited invite link. */
export function InviteAdmin({ on, unlimited }: { on: boolean; unlimited: boolean }) {
  const t = useTranslations("admin.invites");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section
      aria-labelledby="admin-invites"
      className="mx-4 my-4 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 id="admin-invites" className="mb-1 text-lg font-bold">
        {t("title")}
      </h2>
      <p className="mb-3 text-sm text-muted">{on ? t("stateOn") : t("stateOff")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => start(async () => setMsg((await setInviteOnly(!on)) ? t("saved") : t("failed")))}
        >
          {on ? t("turnOff") : t("turnOn")}
        </Button>
        <Button
          variant="secondary"
          disabled={pending || unlimited}
          onClick={() =>
            start(async () => setMsg((await makeMyInvitesUnlimited()) ? t("saved") : t("failed")))
          }
        >
          {unlimited ? t("isUnlimited") : t("makeUnlimited")}
        </Button>
      </div>
      {msg && (
        <p role="status" className="mt-2 text-sm font-bold">
          {msg}
        </p>
      )}
    </section>
  );
}
