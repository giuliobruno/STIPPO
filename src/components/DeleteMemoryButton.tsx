"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteMemoryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Delete this memory? Local media file will be removed.")) return;
    setBusy(true);
    const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/app");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="vm-btn-secondary text-[var(--danger)]"
    >
      {busy ? "Deleting…" : "Delete memory"}
    </button>
  );
}
