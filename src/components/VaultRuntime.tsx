"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { initVault } from "@/lib/vault";
import { processSyncQueue } from "@/lib/vault/sync";

/**
 * Boots vault DB, registers PWA service worker, syncs when back online.
 */
export function VaultRuntime() {
  const { status } = useSession();
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem("stippo_install_dismissed") === "1");

    registerServiceWorker();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!pathname?.startsWith("/app")) return;

    void initVault().catch(() => undefined);

    const sync = () => {
      void processSyncQueue().catch(() => undefined);
    };

    window.addEventListener("online", sync);
    // Initial sync attempt after short delay
    const t = window.setTimeout(sync, 2500);
    return () => {
      window.removeEventListener("online", sync);
      window.clearTimeout(t);
    };
  }, [status, pathname]);

  if (!installEvent || dismissed || !pathname?.startsWith("/app")) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(100%-1.5rem,24rem)] -translate-x-1/2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_12px_40px_rgba(20,20,20,0.12)]">
      <p className="font-[family-name:var(--font-serif)] text-lg">Install Stippo</p>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Add to Home screen for faster capture on site — works as a work app, separate from Photos.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="vm-btn-primary flex-1"
          onClick={async () => {
            await installEvent.prompt();
            setInstallEvent(null);
          }}
        >
          Install
        </button>
        <button
          type="button"
          className="vm-btn-secondary"
          onClick={() => {
            localStorage.setItem("stippo_install_dismissed", "1");
            setDismissed(true);
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Only register in production / secure context (HTTPS or localhost)
  if (typeof window === "undefined") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
