"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Home,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { useT } from "@/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();

  const links = [
    { href: "/app", label: t.shell.navFeed, icon: Home, match: (p: string) => p === "/app" || p.startsWith("/app/memories") },
    { href: "/app/search", label: t.shell.navSearch, icon: Search, match: (p: string) => p.startsWith("/app/search") },
    { href: "/app/projects", label: t.shell.navProjects, icon: FolderKanban, match: (p: string) => p.startsWith("/app/projects") },
  ];

  const captureActive = pathname.startsWith("/app/capture") || pathname.startsWith("/app/guide");

  return (
    <div className="vm-shell mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 pt-5 sm:px-6">
      <header className="mb-7 flex items-center justify-between gap-4">
        <Link href="/app" className="group min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)] transition group-hover:text-[var(--accent)]">
            {t.shell.brandKicker}
          </p>
          <h1 className="vm-brand-mark truncate text-[1.65rem] leading-none sm:text-[1.85rem]">
            {t.shell.brandTitle}
          </h1>
        </Link>
        <UserMenu />
      </header>

      <main className="flex-1">{children}</main>

      <nav className="vm-nav-shell" aria-label="Primary">
        {links.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-medium transition",
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--ink-muted)] hover:bg-black/[0.03] hover:text-[var(--ink)]"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "stroke-[2.25]")} />
              {label}
            </Link>
          );
        })}
        <Link
          href="/app/capture"
          className={cn(
            "ml-0.5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(26,51,84,0.28)] transition active:scale-[0.98]",
            captureActive
              ? "bg-[var(--accent-hover)]"
              : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          )}
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          <span className="hidden sm:inline">{t.shell.navCapture}</span>
        </Link>
      </nav>
    </div>
  );
}
