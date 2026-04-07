"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand"
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel"
import { ProviderLogo } from "@/app/components/ProviderLogo"
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets"

type ProviderCoverage = {
  countryIso: string
  providerCount: number
  productCount: number
  providers: string[]
  categories: string[]
  highlights: string[]
}

type ProviderDiagnostic = {
  provider: "ding" | "dtone"
  configured: boolean
  authOk: boolean
  apiReachable: boolean
  message?: string
  coverage?: ProviderCoverage
  details?: Record<string, unknown>
}

type DiagnosticsResponse = {
  success: boolean
  providers: {
    ding: ProviderDiagnostic
    dtone: ProviderDiagnostic
  }
}

type DtOneStatusAssessment = {
  phase: "completed" | "failed" | "provider-still-processing" | "delayed-provider-processing" | "likely-stalled" | "unknown"
  ageMinutes: number | null
  expiresInMinutes: number | null
  escalationRecommended: boolean
  operatorHint: string
}

type DtOneTransactionLookup = {
  success: boolean
  error?: string
  externalId: string
  rechargeCode?: string | null
  statusAssessment?: DtOneStatusAssessment
  transaction?: {
    id?: number | null
    externalId?: string
    status?: string
    createdAt?: string | null
    expiresAt?: string | null
  }
}

type RankedProvider = {
  id: string
  name: string
  logo_url: string
  tagline: string
  best_for: string
  availability_summary: string
  corridor_focus: string
  payout_networks: string[]
  strengths: string[]
  exchange_rate_score: number
  exchange_rate: number
  fee_score: number
  speed_score: number
  ease_score: number
  efficiency_score: number
  mobile_wallet_speed: number
  bank_deposit_speed: number
  referral_link: string
  sort_order: number
  active: boolean
}

type RankingsResponse = {
  success: boolean
  providers: RankedProvider[]
  source: "supabase" | "fallback"
  warning?: string
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${active ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
      {label}: {active ? "yes" : "no"}
    </span>
  )
}

function FlowModePill({ mode }: { mode: "manual" | "automated" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${mode === "automated" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>
      {mode}
    </span>
  )
}

function formatAssessmentPhase(phase: DtOneStatusAssessment["phase"]) {
  return phase.replaceAll("-", " ")
}

function buildEscalationPacket(transactionLookup: DtOneTransactionLookup) {
  const transaction = transactionLookup.transaction
  const statusAssessment = transactionLookup.statusAssessment

  return [
    `Please investigate DT One transaction ${transaction?.id ?? "unknown"} (external reference ${transactionLookup.externalId}).`,
    "",
    `Current provider status: ${transaction?.status || "UNKNOWN"}`,
    `Derived assessment: ${statusAssessment ? formatAssessmentPhase(statusAssessment.phase) : "unknown"}`,
    `Escalation recommended: ${statusAssessment?.escalationRecommended ? "yes" : "no"}`,
    `Recharge code returned: ${transactionLookup.rechargeCode || "none"}`,
    "",
    statusAssessment?.operatorHint || "No operator hint available.",
    "",
    `Provider reference: ${transaction?.id ?? "unknown"}`,
    `External reference: ${transactionLookup.externalId}`,
    `Created at: ${transaction?.createdAt || "unknown"}`,
    `Expires at: ${transaction?.expiresAt || "unknown"}`
  ].join("\n")
}

export default function InternalProvidersPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null)
  const [rankings, setRankings] = useState<RankedProvider[]>([])
  const [rankingsSource, setRankingsSource] = useState<"supabase" | "fallback" | null>(null)
  const [rankingsWarning, setRankingsWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [transactionLookupId, setTransactionLookupId] = useState("SOUTRALI-1774745059473")
  const [transactionLookup, setTransactionLookup] = useState<DtOneTransactionLookup | null>(null)
  const [transactionLookupLoading, setTransactionLookupLoading] = useState(false)
  const [transactionLookupError, setTransactionLookupError] = useState<string | null>(null)
  const [transactionCopyMessage, setTransactionCopyMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadDtOneTransaction(externalId: string) {
    const normalizedExternalId = externalId.trim()

    if (!normalizedExternalId) {
      setTransactionLookup(null)
      setTransactionLookupError("Enter a DT One external reference.")
      return
    }

    setTransactionLookupLoading(true)
    setTransactionLookupError(null)
    setTransactionCopyMessage(null)

    try {
      const response = await fetch(`/api/internal/providers/dtone-transaction?externalId=${encodeURIComponent(normalizedExternalId)}`, { cache: "no-store" })
      const payload = (await response.json()) as DtOneTransactionLookup

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to load DT One transaction")
      }

      setTransactionLookup(payload)
    } catch (loadError) {
      setTransactionLookup(null)
      setTransactionLookupError(loadError instanceof Error ? loadError.message : "Unable to load DT One transaction")
    } finally {
      setTransactionLookupLoading(false)
    }
  }

  useEffect(() => {
    async function loadDiagnostics() {
      try {
        const [diagnosticsResponse, rankingsResponse] = await Promise.all([
          fetch("/api/internal/providers/diagnostics", { cache: "no-store" }),
          fetch("/api/internal/providers/transfer-rankings", { cache: "no-store" })
        ])

        const diagnosticsPayload = await diagnosticsResponse.json()
        const rankingsPayload = await rankingsResponse.json()

        if (!diagnosticsResponse.ok || !diagnosticsPayload.success) {
          throw new Error(diagnosticsPayload.error || "Unable to load provider diagnostics")
        }

        if (!rankingsResponse.ok || !rankingsPayload.success) {
          throw new Error(rankingsPayload.error || "Unable to load provider rankings")
        }

        setDiagnostics(diagnosticsPayload)
        setRankings(rankingsPayload.providers || [])
        setRankingsSource(rankingsPayload.source || null)
        setRankingsWarning(rankingsPayload.warning || null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load provider diagnostics")
      } finally {
        setLoading(false)
      }
    }

    void loadDiagnostics()
  }, [])

  useEffect(() => {
    void loadDtOneTransaction("SOUTRALI-1774745059473")
  }, [])

  const providerCards = diagnostics ? [diagnostics.providers.ding, diagnostics.providers.dtone] : []

  function updateProviderField(providerId: string, field: keyof RankedProvider, value: string | number | boolean | string[]) {
    setRankings((currentRankings) =>
      currentRankings.map((provider) => {
        if (provider.id !== providerId) {
          return provider
        }

        return {
          ...provider,
          [field]: value
        }
      })
    )
  }

  async function saveProvider(provider: RankedProvider) {
    setSavingProviderId(provider.id)
    setSaveMessage(null)

    try {
      const response = await fetch("/api/internal/providers/transfer-rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider)
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to save provider")
      }

      setRankings((currentRankings) =>
        currentRankings.map((entry) => (entry.id === payload.provider.id ? payload.provider : entry))
      )
      setRankingsSource(payload.source || rankingsSource)
      setRankingsWarning(payload.warning || null)
      setSaveMessage(`${payload.provider.name} saved.`)
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "Unable to save provider")
    } finally {
      setSavingProviderId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#0b1f18_42%,#07120d_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/cote-divoire" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Back to CI hub
            </Link>
            <Link href="/cote-divoire/catalog" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              CI provider catalog
            </Link>
          </div>
        </div>

        <section className="grid gap-6 rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">Internal provider diagnostics</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">Ding and DT One health, reachability, and Côte d&apos;Ivoire coverage.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/78">
              This screen covers automated rails only: airtime, data bundles, and Jumia gift cards. It shows whether each provider is configured, can authenticate, can reach its live API, and what Côte d&apos;Ivoire coverage is currently visible from this environment.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <FlowModePill mode="automated" />
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">airtime</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">data</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50">jumia gift cards</span>
            </div>
          </div>
          <CoteDIvoireHeroPanel
            badge="Provider diagnostics"
            gradientClass="from-[#113D63] via-[#1C5B8A] to-[#4C8BC1]"
            imageSrcs={coteDivoireVisualAssets.catalog}
            imageAlt="Côte d'Ivoire provider coverage cards"
            contextLabel="Côte d'Ivoire"
            wordmark="Afrisendiq"
            heightClassName="h-[20rem]"
          />
        </section>

        {loading ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">
            Loading provider diagnostics...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-[1.75rem] border border-rose-200/50 bg-rose-50 p-6 text-sm text-rose-900">
            {error}
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {providerCards.map((provider) => (
                <article key={provider.provider} className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                        <span>{provider.provider}</span>
                        <FlowModePill mode="automated" />
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold">{provider.provider === "ding" ? "Ding" : "DT One"}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label="configured" active={provider.configured} />
                      <StatusPill label="auth" active={provider.authOk} />
                      <StatusPill label="api" active={provider.apiReachable} />
                    </div>
                  </div>

                  {provider.message ? (
                    <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{provider.message}</div>
                  ) : null}

                  {provider.coverage ? (
                    <div className="mt-6 space-y-5">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl bg-[#F5FBF8] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Country</div>
                          <div className="mt-2 text-lg font-semibold">{provider.coverage.countryIso}</div>
                        </div>
                        <div className="rounded-2xl bg-[#F5FBF8] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Providers</div>
                          <div className="mt-2 text-lg font-semibold">{provider.coverage.providerCount}</div>
                        </div>
                        <div className="rounded-2xl bg-[#F5FBF8] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Products</div>
                          <div className="mt-2 text-lg font-semibold">{provider.coverage.productCount}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Coverage categories</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {provider.coverage.categories.map((category) => (
                            <span key={category} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-700">
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Côte d&apos;Ivoire highlights</div>
                        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
                          {provider.coverage.highlights.map((highlight) => (
                            <li key={highlight} className="rounded-2xl bg-slate-50 px-4 py-3">{highlight}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Visible providers</div>
                        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
                          {provider.coverage.providers.map((providerName) => (
                            <li key={providerName} className="rounded-2xl bg-slate-50 px-4 py-3">{providerName}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                  ) : null}

                  {provider.details ? (
                    <pre className="mt-6 overflow-x-auto rounded-2xl bg-[#0E2E23] p-4 text-xs leading-6 text-emerald-50">{JSON.stringify(provider.details, null, 2)}</pre>
                  ) : null}
                </article>
              ))}
            </section>

            <section className="mt-8 rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    <span>DT One transaction monitor</span>
                    <FlowModePill mode="automated" />
                  </div>
                  <h2 className="mt-2 text-3xl font-semibold">Operator hint and escalation state for a live DT One reference.</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    This lookup reads the internal DT One transaction route for still-automated provider transactions and derives whether the provider is still processing normally, delayed, or likely stalled.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-end gap-4">
                <label className="min-w-[20rem] flex-1 text-sm font-medium text-slate-700">
                  External reference
                  <input
                    value={transactionLookupId}
                    onChange={(event) => setTransactionLookupId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void loadDtOneTransaction(transactionLookupId)}
                  disabled={transactionLookupLoading}
                  className="rounded-full bg-[#0E2E23] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#154335] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {transactionLookupLoading ? "Checking..." : "Check DT One transaction"}
                </button>
              </div>

              {transactionLookupError ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{transactionLookupError}</div>
              ) : null}

              {transactionLookup ? (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(buildEscalationPacket(transactionLookup))
                        setTransactionCopyMessage("Escalation packet copied.")
                      }}
                      className="rounded-full bg-[#0E2E23] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#154335]"
                    >
                      Copy escalation packet
                    </button>
                    {transactionCopyMessage ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-900">{transactionCopyMessage}</span> : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-[#F5FBF8] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Phase</div>
                      <div className="mt-2 text-lg font-semibold capitalize">{transactionLookup.statusAssessment ? formatAssessmentPhase(transactionLookup.statusAssessment.phase) : "unknown"}</div>
                    </div>
                    <div className="rounded-2xl bg-[#F5FBF8] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Provider status</div>
                      <div className="mt-2 text-lg font-semibold">{transactionLookup.transaction?.status || "UNKNOWN"}</div>
                    </div>
                    <div className="rounded-2xl bg-[#F5FBF8] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Age</div>
                      <div className="mt-2 text-lg font-semibold">{transactionLookup.statusAssessment?.ageMinutes ?? "-"} min</div>
                    </div>
                    <div className="rounded-2xl bg-[#F5FBF8] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Escalate</div>
                      <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-[0.12em] ${transactionLookup.statusAssessment?.escalationRecommended ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"}`}>
                        {transactionLookup.statusAssessment?.escalationRecommended ? "yes" : "no"}
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-[1.5rem] border p-5 ${transactionLookup.statusAssessment?.escalationRecommended ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operator hint</div>
                    <p className="mt-3 text-sm leading-7 text-slate-800">{transactionLookup.statusAssessment?.operatorHint || "No assessment available."}</p>
                    <pre className="mt-4 overflow-x-auto rounded-2xl bg-white/80 p-4 text-xs leading-6 text-slate-700">{buildEscalationPacket(transactionLookup)}</pre>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-[#FBFDFC] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">External reference</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{transactionLookup.externalId}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-[#FBFDFC] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Provider reference</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{transactionLookup.transaction?.id ?? "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-[#FBFDFC] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Expires in</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{transactionLookup.statusAssessment?.expiresInMinutes ?? "-"} min</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-[#FBFDFC] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recharge code</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{transactionLookup.rechargeCode || "not available"}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="mt-8 rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Homepage rankings editor</div>
                  <h2 className="mt-2 text-3xl font-semibold">Edit provider logos, metadata, and scoring without touching SQL.</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    This editor updates the provider dataset used by the homepage compare experience. Scores still drive the public ranking, while the richer fields shape the card narrative and logo treatment.
                  </p>
                </div>
                <Link href="/" className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100">
                  Open homepage compare
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className={`rounded-full px-3 py-1 font-semibold uppercase tracking-[0.16em] ${rankingsSource === "supabase" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                  source: {rankingsSource || "unknown"}
                </span>
                {rankingsWarning ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">{rankingsWarning}</span> : null}
                {saveMessage ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{saveMessage}</span> : null}
              </div>

              <div className="mt-8 space-y-6">
                {rankings.map((provider) => (
                  <article key={provider.id} className="rounded-[1.5rem] border border-slate-200 bg-[#FBFDFC] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <ProviderLogo src={provider.logo_url} alt={provider.name} />
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{provider.id}</div>
                          <h3 className="mt-1 text-2xl font-semibold">{provider.name}</h3>
                          <p className="mt-1 text-sm text-slate-600">{provider.tagline || "Add a short positioning line for the homepage card."}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveProvider(provider)}
                        disabled={savingProviderId === provider.id}
                        className="rounded-full bg-[#0E2E23] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#154335] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingProviderId === provider.id ? "Saving..." : "Save provider"}
                      </button>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <label className="text-sm font-medium text-slate-700">
                        Name
                        <input
                          value={provider.name}
                          onChange={(event) => updateProviderField(provider.id, "name", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Logo path
                        <input
                          value={provider.logo_url}
                          onChange={(event) => updateProviderField(provider.id, "logo_url", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Referral URL
                        <input
                          value={provider.referral_link}
                          onChange={(event) => updateProviderField(provider.id, "referral_link", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
                        Tagline
                        <input
                          value={provider.tagline}
                          onChange={(event) => updateProviderField(provider.id, "tagline", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Best for
                        <input
                          value={provider.best_for}
                          onChange={(event) => updateProviderField(provider.id, "best_for", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Corridor focus
                        <input
                          value={provider.corridor_focus}
                          onChange={(event) => updateProviderField(provider.id, "corridor_focus", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Sort order
                        <input
                          type="number"
                          value={provider.sort_order}
                          onChange={(event) => updateProviderField(provider.id, "sort_order", Number(event.target.value))}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
                        Availability summary
                        <textarea
                          value={provider.availability_summary}
                          onChange={(event) => updateProviderField(provider.id, "availability_summary", event.target.value)}
                          rows={3}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700 xl:col-span-2">
                        Payout networks
                        <textarea
                          value={provider.payout_networks.join(", ")}
                          onChange={(event) => updateProviderField(provider.id, "payout_networks", event.target.value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean))}
                          rows={2}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700 xl:col-span-1">
                        Strengths
                        <textarea
                          value={provider.strengths.join(", ")}
                          onChange={(event) => updateProviderField(provider.id, "strengths", event.target.value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean))}
                          rows={2}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["exchange_rate_score", "Exchange score"],
                        ["exchange_rate", "Exchange rate"],
                        ["fee_score", "Fee score"],
                        ["speed_score", "Speed score"],
                        ["ease_score", "Ease score"],
                        ["efficiency_score", "Efficiency score"],
                        ["mobile_wallet_speed", "Wallet speed"],
                        ["bank_deposit_speed", "Bank speed"]
                      ].map(([field, label]) => (
                        <label key={field} className="text-sm font-medium text-slate-700">
                          {label}
                          <input
                            type="number"
                            step="0.01"
                            value={provider[field as keyof RankedProvider] as number}
                            onChange={(event) => updateProviderField(provider.id, field as keyof RankedProvider, Number(event.target.value))}
                            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                          />
                        </label>
                      ))}
                    </div>

                    <label className="mt-5 flex items-center gap-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={provider.active}
                        onChange={(event) => updateProviderField(provider.id, "active", event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Show this provider on the public homepage compare experience
                    </label>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}