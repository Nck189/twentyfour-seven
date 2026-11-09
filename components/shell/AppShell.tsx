"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppMark } from "@/components/art/AppMark";
import { useStatsRevealed } from "@/lib/unlocks/useUnlocks";
import { NAV_ITEMS } from "./nav";

/**
 * Phone: content + bottom tab bar.
 * iPad/Mac (≥1024px): side rail + main column (timeline) + right panel (farm/backlog).
 */
export function AppShell({ children, side }: { children: ReactNode; side: ReactNode }) {
  const t = useTranslations("tabs");
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Feature reveal (SPEC §8.8b): Stats appears once there are a few days to show.
  const statsShown = useStatsRevealed();
  const items = NAV_ITEMS.filter((i) => i.key !== "stats" || statsShown || isActive(i.href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)]">
      <nav
        aria-label={t("nav")}
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:items-center lg:gap-2 lg:border-r lg:border-line lg:bg-surface lg:pt-[max(1rem,env(safe-area-inset-top))] lg:pb-4"
      >
        <AppMark className="mb-4 h-11 w-11" />
        {items.map(({ href, key, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`tap flex min-h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl text-xs leading-relaxed font-bold ${
              isActive(href) ? "bg-primary-soft text-primary" : "text-muted"
            }`}
          >
            <Icon className="h-6 w-6" />
            {t(key)}
          </Link>
        ))}
      </nav>

      <main className="safe-top min-w-0 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>

      <aside className="safe-top hidden min-w-0 border-l border-line bg-surface-2/40 lg:block">{side}</aside>

      <nav
        aria-label={t("nav")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl justify-around">
          {items.map(({ href, key, Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`tap flex min-h-[60px] flex-col items-center justify-center gap-1 pt-1 text-xs leading-relaxed font-bold ${
                  isActive(href) ? "text-primary" : "text-muted"
                }`}
              >
                <Icon className="h-6 w-6" />
                {t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
