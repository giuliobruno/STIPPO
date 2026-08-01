import { Suspense } from "react";
import { BillingPanel } from "@/components/BillingPanel";

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--ink-muted)]">Loading billing…</p>}>
      <BillingPanel />
    </Suspense>
  );
}
