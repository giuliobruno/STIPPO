"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteVaultMemory } from "@/lib/vault";
import { processSyncQueue } from "@/lib/vault/sync";

export function DeleteMemoryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Delete this reference from your work vault?")) return;
    setBusy(true);
    try {
      await deleteVaultMemory(id);
      void processSyncQueue().catch(() => undefined);
      // Best-effort legacy cleanup
      void fetch(`/api/memories/${id}`, { method: "DELETE" }).catch(() => undefined);
      router.push("/app");
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={busy}
      className="vm-btn-secondary text-[var(--danger)]"
    >
      {busy ? "Deleting…" : "Delete memory"}
    </button>
  );
}
