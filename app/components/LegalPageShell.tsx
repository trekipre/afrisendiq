import Link from "next/link"
import { ReactNode } from "react"
import { AfriSendIQBrand } from "./AfriSendIQBrand"

type SummaryItem = {
  title: string
  description: string
}

type QuickFact = {
  label: string
  value: string
}

type LegalPageShellProps = {
  eyebrow: string
  title: string
  subtitle: string
  lastUpdated: string
  summaryTitle: string
  summaryItems: SummaryItem[]
  quickFacts: QuickFact[]
  children: ReactNode
}

export function LegalPageShell({
  eyebrow,
  title,
  subtitle,
  lastUpdated,
  summaryTitle,
  summaryItems,
  quickFacts,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#16634a_0%,#0c1f18_38%,#081711_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3 text-sm text-emerald-50/78">
            <Link
              href="/"
              className="rounded-full border border-white/12 bg-white/8 px-4 py-2 transition hover:bg-white/12"
            >
              Home
            </Link>
            <Link
              href="/terms"
              className="rounded-full border border-white/12 bg-white/8 px-4 py-2 transition hover:bg-white/12"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="rounded-full border border-white/12 bg-white/8 px-4 py-2 transition hover:bg-white/12"
            >
              Privacy
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <section className="rounded-[2rem] border border-emerald-300/14 bg-white/10 p-8 shadow-[0_24px_90px_rgba(0,0,0,0.18)] backdrop-blur">
            <p className="text-sm uppercase tracking-[0.22em] text-emerald-200/78">{eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50/76 md:text-lg">{subtitle}</p>
            <div className="mt-6 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">
              Last updated: {lastUpdated}
            </div>
          </section>

          <aside className="rounded-[2rem] bg-white p-6 text-black shadow-[0_24px_80px_rgba(6,14,11,0.18)]">
            <h2 className="text-lg font-semibold text-[#0F3D2E]">Quick Facts</h2>
            <div className="mt-4 space-y-4">
              {quickFacts.map((fact) => (
                <div key={fact.label} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/75">{fact.label}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-700">{fact.value}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur md:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">{summaryTitle}</h2>
            <Link
              href="mailto:support@afrisendiq.com"
              className="rounded-full border border-emerald-200/25 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-emerald-300/16"
            >
              support@afrisendiq.com
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryItems.map((item) => (
              <div key={item.title} className="rounded-[1.5rem] bg-white/10 p-5">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-50/76">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <article className="mt-8 rounded-[2rem] bg-white p-6 text-slate-900 shadow-[0_24px_80px_rgba(6,14,11,0.18)] md:p-8">
          <div className="space-y-8">{children}</div>
        </article>
      </div>
    </main>
  )
}

type LegalSectionProps = {
  id: string
  title: string
  children: ReactNode
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-8 border-b border-slate-200 pb-8 last:border-b-0 last:pb-0">
      <h2 className="text-2xl font-semibold text-[#0F3D2E]">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700 md:text-[15px]">{children}</div>
    </section>
  )
}