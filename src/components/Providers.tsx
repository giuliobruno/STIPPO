"use client";

import { SessionProvider } from "next-auth/react";
import { VaultRuntime } from "@/components/VaultRuntime";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <VaultRuntime />
    </SessionProvider>
  );
}
