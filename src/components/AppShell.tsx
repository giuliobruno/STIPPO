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

const links = [
  { href: "/app", label: "Feed", icon: Home },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="vm-shell mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 pt-6 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/app" className="group">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Stippo
          </p>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl leading-tight text-[var(--ink)] sm:text-[1.75rem]">
            Work vault
          </h1>
        </Link>
        <UserMenu />
      </header>

      <main className="flex-1">{children}</main>

      <nav className="fixed bottom-4 left-1/2 z-40 flex w-[min(100%-1.5rem,36rem)] -translate-x-1/2 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-2 shadow-[0_12px_40px_rgba(20,20,20,0.08)] backdrop-blur">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium",
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
        <Link
          href="/app/capture"
          className="vm-btn-primary ml-1 !rounded-xl !px-4 !py-3"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Capture</span>
        </Link>
      </nav>
    </div>
  );
}
