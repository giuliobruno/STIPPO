import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: { deleted?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/app");

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-16 pt-8">
        <header className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Visual Memory
          </p>
          <div className="flex gap-2">
            <Link href="/login" className="vm-btn-ghost">
              Sign in
            </Link>
            <Link href="/signup" className="vm-btn-primary">
              Start free
            </Link>
          </div>
        </header>

        {searchParams?.deleted === "1" ? (
          <p className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-muted)]">
            Your account and associated data have been deleted.
          </p>
        ) : null}

        <section className="flex flex-1 flex-col justify-center py-16">
          <p className="mb-4 text-sm font-medium text-[var(--accent)]">
            For architects & interior designers
          </p>
          <h1 className="max-w-3xl font-[family-name:var(--font-serif)] text-5xl leading-[1.05] tracking-tight text-[var(--ink)] sm:text-6xl md:text-7xl">
            Your project references, finally findable.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[var(--ink-muted)]">
            Snap a detail. Speak the thought. Originals stay on your device —
            we store the understanding so you can ask months later.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/signup" className="vm-btn-primary !px-6 !py-3.5 text-base">
              Capture your first memory
            </Link>
            <Link href="/login" className="vm-btn-secondary !px-6 !py-3.5 text-base">
              I already have an account
            </Link>
          </div>
        </section>

        <section className="grid gap-6 border-t border-[var(--line)] pt-12 sm:grid-cols-3">
          {[
            {
              title: "Image + voice = one memory",
              body: "Not just a saved photo — the intent, material, and project travel with it.",
            },
            {
              title: "Project-native",
              body: "Milan Hotel. Navigli apartment. Client Rossi. No folder hell.",
            },
            {
              title: "Local-first privacy",
              body: "Full-resolution files stay local. The cloud holds a light semantic index.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="font-[family-name:var(--font-serif)] text-xl">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 sm:p-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            Pricing (architecture ready)
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { name: "Free", price: "€0", detail: "100 memories · basic AI" },
              { name: "Pro", price: "$15/mo", detail: "Unlimited · advanced search · projects" },
              { name: "Studio", price: "$49/user", detail: "Shared project library · team" },
            ].map((tier) => (
              <div key={tier.name} className="rounded-2xl border border-[var(--line)] p-5">
                <p className="text-sm text-[var(--ink-muted)]">{tier.name}</p>
                <p className="mt-1 font-[family-name:var(--font-serif)] text-3xl">{tier.price}</p>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">{tier.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-8 text-sm text-[var(--ink-muted)]">
          <p>© {new Date().getFullYear()} Visual Memory</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-[var(--ink)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--ink)]">
              Terms
            </Link>
            <Link href="/disclaimer" className="hover:text-[var(--ink)]">
              Disclaimers
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
