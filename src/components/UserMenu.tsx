"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  ChevronDown,
  Cloud,
  CreditCard,
  FileText,
  Languages,
  LogOut,
  Scale,
  Shield,
  UserRound,
} from "lucide-react";
import { fill, localeLabels, locales, useLocale, useT, type Locale } from "@/i18n";

export function UserMenu() {
  const { data } = useSession();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const email = data?.user?.email ?? "";
  const name = data?.user?.name ?? email.split("@")[0] ?? "Account";
  const plan = data?.user?.plan ?? "free";
  const initial = (name || email || "U").charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-1.5 pr-2.5 text-left transition hover:border-[#c4bdb0]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-sm font-medium text-[var(--accent)]">
          {initial}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium leading-tight">{name}</span>
          <span className="block truncate text-[11px] capitalize text-[var(--ink-muted)]">
            {fill(t.menu.plan, { plan })}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--ink-muted)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_16px_48px_rgba(20,20,20,0.12)]"
        >
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-[var(--ink-muted)]">{email}</p>
          </div>
          <div className="border-b border-[var(--line)] px-3 py-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              <Languages className="h-3.5 w-3.5" />
              {t.menu.language}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {locales.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === code}
                  className={`rounded-lg px-1.5 py-1.5 text-xs font-medium transition ${
                    locale === code
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--ink-muted)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                  }`}
                  onClick={() => setLocale(code as Locale)}
                >
                  {localeLabels[code]}
                </button>
              ))}
            </div>
          </div>
          <div className="p-1.5">
            <MenuLink href="/app/account" icon={UserRound} onClick={() => setOpen(false)}>
              {t.menu.account}
            </MenuLink>
            <MenuLink href="/app/vault" icon={Cloud} onClick={() => setOpen(false)}>
              {t.menu.vault}
            </MenuLink>
            <MenuLink href="/app/billing" icon={CreditCard} onClick={() => setOpen(false)}>
              {t.menu.billing}
            </MenuLink>
            <MenuLink href="/privacy" icon={Shield} onClick={() => setOpen(false)}>
              {t.menu.privacy}
            </MenuLink>
            <MenuLink href="/terms" icon={FileText} onClick={() => setOpen(false)}>
              {t.menu.terms}
            </MenuLink>
            <MenuLink href="/disclaimer" icon={Scale} onClick={() => setOpen(false)}>
              {t.menu.disclaimer}
            </MenuLink>
          </div>
          <div className="border-t border-[var(--line)] p-1.5">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--danger)] transition hover:bg-red-50"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-4 w-4" />
              {t.menu.signOut}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
    >
      <Icon className="h-4 w-4 text-[var(--ink-muted)]" />
      {children}
    </Link>
  );
}
