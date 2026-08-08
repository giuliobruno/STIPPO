"use client";

import { SessionProvider } from "next-auth/react";
import { VaultRuntime } from "@/components/VaultRuntime";
import { LocaleProvider } from "@/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        {children}
        <VaultRuntime />
      </LocaleProvider>
    </SessionProvider>
  );
}
