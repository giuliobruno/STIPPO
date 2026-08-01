import { Suspense } from "react";
import { CaptureForm } from "@/components/CaptureForm";

export default function CapturePage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--ink-muted)]">Loading capture…</p>}>
      <CaptureForm />
    </Suspense>
  );
}
