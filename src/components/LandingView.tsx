"use client";

import Link from "next/link";
import { fill, localeLabels, locales, useLocale, useT, type Locale } from "@/i18n";

type LandingViewProps = {
  deleted?: boolean;
  signedIn?: boolean;
};

export function LandingView({ deleted, signedIn }: LandingViewProps) {
  const t = useT();
  const { locale, setLocale, ready } = useLocale();
  const L = t.landing;

  const features = [
    { title: L.feature1Title, body: L.feature1Body },
    { title: L.feature2Title, body: L.feature2Body },
    { title: L.feature3Title, body: L.feature3Body },
    { title: L.feature4Title, body: L.feature4Body },
    { title: L.feature5Title, body: L.feature5Body },
    { title: L.feature6Title, body: L.feature6Body },
  ];

  const steps = [
    { title: L.how1Title, body: L.how1Body },
    { title: L.how2Title, body: L.how2Body },
    { title: L.how3Title, body: L.how3Body },
  ];

  const tiers = [
    { name: L.tierFree, price: L.tierFreePrice, detail: L.tierFreeDetail, featured: false },
    { name: L.tierPro, price: L.tierProPrice, detail: L.tierProDetail, featured: true },
    { name: L.tierStudio, price: L.tierStudioPrice, detail: L.tierStudioDetail, featured: false },
  ];

  return (
    <div
      className={`min-h-screen transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-20 pt-6 sm:px-8">
        <header className="vm-fade-in flex flex-wrap items-center justify-between gap-3">
          <p className="vm-brand-mark text-2xl sm:text-[1.75rem]">{L.brand}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="landing-locale">
              {L.language}
            </label>
            <select
              id="landing-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--ink)]"
            >
              {locales.map((code) => (
                <option key={code} value={code}>
                  {localeLabels[code]}
                </option>
              ))}
            </select>
            {signedIn ? (
              <Link href="/app" className="vm-btn-primary">
                {L.openApp}
              </Link>
            ) : (
              <>
                <Link href="/login" className="vm-btn-ghost">
                  {L.signIn}
                </Link>
                <Link href="/signup" className="vm-btn-primary">
                  {L.startFree}
                </Link>
              </>
            )}
          </div>
        </header>

        {deleted ? (
          <p className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-muted)]">
            {L.deletedNotice}
          </p>
        ) : null}

        <section className="relative grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-20">
          <div className="relative z-10">
            <p className="vm-fade-in-delay-1 mb-5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
              {L.eyebrow}
            </p>
            <h1 className="vm-fade-in-delay-1 font-[family-name:var(--font-serif)] text-[2.75rem] leading-[1.05] tracking-tight text-[var(--ink)] sm:text-6xl md:text-[4.25rem]">
              {L.headline}
            </h1>
            <p className="vm-fade-in-delay-2 mt-6 max-w-lg text-base leading-relaxed text-[var(--ink-muted)] sm:text-lg">
              {L.subhead}
            </p>
            <div className="vm-fade-in-delay-2 mt-9 flex flex-wrap gap-3">
              {signedIn ? (
                <Link href="/app" className="vm-btn-primary !px-6 !py-3.5 text-base">
                  {L.openApp}
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="vm-btn-primary !px-6 !py-3.5 text-base">
                    {L.ctaStart}
                  </Link>
                  <Link href="/login" className="vm-btn-secondary !px-6 !py-3.5 text-base">
                    {L.ctaLogin}
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="vm-fade-in-delay-3 relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <ProductMock brand={L.brand} steps={steps.map((s) => s.title)} />
          </div>
        </section>

        <section className="border-t border-[var(--line)] pt-14">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight text-[var(--ink)] sm:text-4xl">
            {L.whatTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">{L.whatIntro}</p>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item, i) => (
              <div key={item.title} className="relative pl-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="font-[family-name:var(--font-serif)] text-xl tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 border-t border-[var(--line)] pt-14">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight text-[var(--ink)] sm:text-4xl">
            {L.howTitle}
          </h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="relative">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-medium text-white">
                  {i + 1}
                </div>
                <h3 className="font-[family-name:var(--font-serif)] text-xl tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 border-t border-[var(--line)] pt-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            {L.pricingTitle}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-[1.25rem] border p-6 ${
                  tier.featured
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                <p
                  className={`text-sm ${tier.featured ? "text-white/70" : "text-[var(--ink-muted)]"}`}
                >
                  {tier.name}
                </p>
                <p className="mt-1 font-[family-name:var(--font-serif)] text-3xl tracking-tight">
                  {tier.price}
                </p>
                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    tier.featured ? "text-white/80" : "text-[var(--ink-muted)]"
                  }`}
                >
                  {tier.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-8 text-sm text-[var(--ink-muted)]">
          <p>{fill(L.copyright, { year: new Date().getFullYear() })}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-[var(--ink)]">
              {L.privacy}
            </Link>
            <Link href="/terms" className="hover:text-[var(--ink)]">
              {L.terms}
            </Link>
            <Link href="/disclaimer" className="hover:text-[var(--ink)]">
              {L.disclaimer}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ProductMock({ brand, steps }: { brand: string; steps: string[] }) {
  const tiles = [
    { h: "h-28", tone: "from-[#c8d2df] to-[#aeb9c9]" },
    { h: "h-36", tone: "from-[#d8cfc0] to-[#bfb3a0]" },
    { h: "h-24", tone: "from-[#b9c8c2] to-[#97aca3]" },
    { h: "h-32", tone: "from-[#cfc6b8] to-[#b5a994]" },
  ];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_30%_20%,rgba(26,51,84,0.1),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(191,165,120,0.18),transparent_50%)]"
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_60px_rgba(18,20,26,0.12)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              {brand}
            </p>
            <p className="font-[family-name:var(--font-serif)] text-lg leading-tight">
              {steps[0]}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <span className="text-lg leading-none">+</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {tiles.map((tile, i) => (
            <div
              key={tile.h + i}
              className={`${tile.h} rounded-xl bg-gradient-to-br ${tile.tone} ${
                i === 1 ? "row-span-2 h-auto min-h-[9.5rem]" : ""
              }`}
            >
              <div className="flex h-full flex-col justify-end p-3">
                <div className="h-1.5 w-16 rounded-full bg-white/50" />
                <div className="mt-1.5 h-1.5 w-10 rounded-full bg-white/35" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-3">
          {steps.map((label, i) => (
            <div
              key={label}
              className={`flex-1 rounded-xl px-2 py-2 text-center text-[11px] font-medium ${
                i === 0
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--ink-muted)]"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
