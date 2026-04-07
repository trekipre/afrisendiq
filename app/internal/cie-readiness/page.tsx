"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand"
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel"
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets"

type ReadinessCheck = {
  id: string
  label: string
  status: "pass" | "warn" | "fail"
  detail: string
}

type ReadinessReport = {
  generatedAt: string
  mode: "live" | "test" | "blocked"
  safeForLiveOrders: boolean
  safeForTestOrders: boolean
  checks: ReadinessCheck[]
  blockers: string[]
}

function statusStyles(status: ReadinessCheck["status"]) {
  if (status === "pass") {
    return "bg-emerald-100 text-emerald-900"
  }

  if (status === "warn") {
    return "bg-amber-100 text-amber-900"
  }

  return "bg-rose-100 text-rose-900"
}

export default function InternalCieReadinessPage() {
  const [report, setReport] = useState<ReadinessReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch("/api/internal/cie-readiness")
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Unable to load CIE readiness report")
        }

        setReport(payload.report)
        setError(null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load CIE readiness report")
      } finally {
        setLoading(false)
      }
    }

    void loadReport()
  }, [])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#0b1f18_42%,#07120d_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/internal/manual-billing" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Manual billing queue
            </Link>
            <Link href="/internal/profitability" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Profitability
            </Link>
            <button onClick={() => window.location.reload()} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Refresh
            </button>
          </div>
        </div>

        <section className="grid gap-6 rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">CIE live readiness</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">Readiness gate before taking a real CIE FACTURE payment.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/78">
              This screen validates the exact runtime pieces used by the manual CIE FACTURE flow: public URLs, Supabase reachability, Stripe keys and webhook secret, Telegram operator routing, and Twilio WhatsApp delivery for customer confirmation.
            </p>
          </div>
          <CoteDIvoireHeroPanel
            badge="CIE readiness"
            gradientClass="from-[#7A4A05] via-[#B46907] to-[#F2B94B]"
            imageSrcs={coteDivoireVisualAssets.ciePostpaid}
            imageAlt="CIE bill readiness card"
            contextLabel="Côte d'Ivoire"
            wordmark="Afrisendiq"
            heightClassName="h-[20rem]"
          />
        </section>

        {loading ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">
            Running readiness checks...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-[1.75rem] border border-rose-200/50 bg-rose-50 p-6 text-sm text-rose-900">
            {error}
          </div>
        ) : report ? (
          <>
            <section className="mt-8 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
              <article className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Decision</div>
                <div className="mt-3 text-3xl font-semibold uppercase">{report.mode}</div>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-[#F5FBF8] px-4 py-3">
                    Live safe: <strong>{report.safeForLiveOrders ? "yes" : "no"}</strong>
                  </div>
                  <div className="rounded-2xl bg-[#F5FBF8] px-4 py-3">
                    Test safe: <strong>{report.safeForTestOrders ? "yes" : "no"}</strong>
                  </div>
                  <div className="rounded-2xl bg-[#F5FBF8] px-4 py-3">
                    Generated: <strong>{new Date(report.generatedAt).toLocaleString()}</strong>
                  </div>
                </div>
              </article>

              <article className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Blockers</div>
                {report.blockers.length === 0 ? (
                  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">No hard blockers detected.</div>
                ) : (
                  <ul className="mt-4 grid gap-3 text-sm text-slate-700">
                    {report.blockers.map((blocker) => (
                      <li key={blocker} className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-900">{blocker}</li>
                    ))}
                  </ul>
                )}
              </article>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {report.checks.map((check) => (
                <article key={check.id} className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold">{check.label}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusStyles(check.status)}`}>
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{check.detail}</p>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}