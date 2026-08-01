"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, location }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create project");
      return;
    }
    setName("");
    setLocation("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="vm-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="vm-label" htmlFor="pname">
          New project
        </label>
        <input
          id="pname"
          className="vm-input"
          required
          placeholder="Luxury Hotel Milan"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex-1">
        <label className="vm-label" htmlFor="ploc">
          Location
        </label>
        <input
          id="ploc"
          className="vm-input"
          placeholder="Milan, Italy"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <button className="vm-btn-primary" disabled={busy}>
        {busy ? "…" : "Add"}
      </button>
      {error ? <p className="text-sm text-[var(--danger)] sm:w-full">{error}</p> : null}
    </form>
  );
}
