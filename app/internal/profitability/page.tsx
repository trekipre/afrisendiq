"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand"
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel"
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets"
import { DEFAULT_STUCK_PAID_THRESHOLD_MINUTES, getStuckPaidOrders } from "@/app/lib/internalAlerts"

type ProfitabilityRow = {
  flowType: "jit" | "manual_billing"
  orderId: string
  traceId: string
  serviceCategory: string
  serviceReference: string
  customerReference: string
  recipientLabel: string
  customerName?: string
  customerEmail?: string
  status: string
  currency: string
  inputAmount: number | null
  providerCost: number | null
  customerPrice: number | null
  netMargin: number | null
  netMarginPercent: number | null
  grossMargin: number | null
  grossMarginPercent: number | null
  operatingCost: number | null
  netMarginAfterFees: number | null
  paymentMethod?: string
  userCountryCode?: string
  aiLocationCluster?: string
  aiProfileSource?: "static" | "learned"
  provider?: string
  pricingStrategy?: string
  pricingDecision?: {
    aiOptimization?: {
      paymentMethod?: string
      userCountryCode?: string
      locationCluster?: string
      locationProfileSource?: "static" | "learned"
      locationProfileSampleSize?: number
    }
  }
  failureReason?: string
  realizedAt?: string
  createdAt: string
  updatedAt: string
  realized: boolean
}

type ProfitabilitySummary = {
  totalOrders: number
  realizedOrders: number
  jitOrders: number
  manualBillingOrders: number
  realizedNetMargin: number
  expectedNetMargin: number
  realizedGrossMargin: number
  totalOperatingCost: number
}

type ProfitabilityPayload = {
  rows: ProfitabilityRow[]
  settings?: {
    stuckPaidThresholdMinutes?: number
    updatedAt?: string
    source?: "supabase" | "fallback"
  }
  summary: ProfitabilitySummary
}

type SecurityDiagnosticRow = {
  tableName: string
  classification: "sensitive" | "public_read_only"
  existsInSchema: boolean
  rowSecurityEnabled: boolean
  policyCount: number
  anonSelect: boolean
  anonInsert: boolean
  anonUpdate: boolean
  anonDelete: boolean
  authenticatedSelect: boolean
  authenticatedInsert: boolean
  authenticatedUpdate: boolean
  authenticatedDelete: boolean
  serviceRoleSelect: boolean
  expectedExposure: "locked_down" | "public_read_only"
  status: "ok" | "review" | "missing"
}

type SecurityPayload = {
  generatedAt: string
  rows: SecurityDiagnosticRow[]
  summary: {
    totalTables: number
    okTables: number
    reviewTables: number
    missingTables: number
    sensitiveTables: number
  }
}

function formatMoney(value: number | null | undefined, currency: string) {
  if (typeof value !== "number") {
    return "Unavailable"
  }

  return `${value.toLocaleString()} ${currency}`
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "Unavailable"
}

function sumNumbers(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0)
}

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return ""
  }

  const serialized = String(value)
  if (!/[",\n]/.test(serialized)) {
    return serialized
  }

  return `"${serialized.replaceAll('"', '""')}"`
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getDateReference(row: ProfitabilityRow, dateField: string) {
  if (dateField === "realized") {
    return row.realizedAt
  }

  if (dateField === "updated") {
    return row.updatedAt
  }

  return row.createdAt
}

function getFlowMode(flowType: ProfitabilityRow["flowType"]) {
  return flowType === "manual_billing" ? "manual" : "automated"
}

function getAiOptimization(row: ProfitabilityRow) {
  return row.pricingDecision?.aiOptimization
}

function getResolvedPaymentMethod(row: ProfitabilityRow) {
  return row.paymentMethod ?? getAiOptimization(row)?.paymentMethod ?? "unclassified"
}

function getResolvedUserCountryCode(row: ProfitabilityRow) {
  return row.userCountryCode ?? getAiOptimization(row)?.userCountryCode ?? "Unknown"
}

function getResolvedAiCluster(row: ProfitabilityRow) {
  return row.aiLocationCluster ?? getAiOptimization(row)?.locationCluster ?? "baseline"
}

function getResolvedAiProfileSource(row: ProfitabilityRow) {
  return row.aiProfileSource ?? getAiOptimization(row)?.locationProfileSource ?? "static"
}

function getCorridorLabel(row: ProfitabilityRow) {
  return `${getResolvedUserCountryCode(row)} -> CI/XOF`
}

function formatProfileSource(source: "static" | "learned") {
  return source === "learned" ? "Learned" : "Static"
}

function FlowModePill({ mode }: { mode: "manual" | "automated" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${mode === "manual" ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-900"}`}>
      {mode}
    </span>
  )
}

export default function InternalProfitabilityPage() {
  const [report, setReport] = useState<ProfitabilityPayload | null>(null)
  const [securityReport, setSecurityReport] = useState<SecurityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [flowFilter, setFlowFilter] = useState<string>("all")
  const [realizedFilter, setRealizedFilter] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [dateField, setDateField] = useState<string>("created")
  const [startDate, setStartDate] = useState<string>(toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [endDate, setEndDate] = useState<string>(toDateInputValue(new Date()))
  const [stuckPaidThresholdMinutes, setStuckPaidThresholdMinutes] = useState(DEFAULT_STUCK_PAID_THRESHOLD_MINUTES)
  const [thresholdInput, setThresholdInput] = useState(String(DEFAULT_STUCK_PAID_THRESHOLD_MINUTES))

  useEffect(() => {
    async function loadReport() {
      try {
        const [profitabilityResponse, securityResponse] = await Promise.all([
          fetch("/api/internal/profitability"),
          fetch("/api/internal/security")
        ])

        const profitabilityPayload = await profitabilityResponse.json()
        const securityPayload = await securityResponse.json()

        if (!profitabilityResponse.ok || !profitabilityPayload.success) {
          throw new Error(profitabilityPayload.error || "Unable to load profitability analytics")
        }

        if (!securityResponse.ok || !securityPayload.success) {
          throw new Error(securityPayload.error || "Unable to load security diagnostics")
        }

        setReport({ rows: profitabilityPayload.rows || [], summary: profitabilityPayload.summary, settings: profitabilityPayload.settings })
        setSecurityReport({
          generatedAt: securityPayload.generatedAt,
          rows: securityPayload.rows || [],
          summary: securityPayload.summary
        })
        const nextThreshold = Number(profitabilityPayload.settings?.stuckPaidThresholdMinutes)
        if (Number.isFinite(nextThreshold) && nextThreshold > 0) {
          const normalizedThreshold = Math.floor(nextThreshold)
          setStuckPaidThresholdMinutes(normalizedThreshold)
          setThresholdInput(String(normalizedThreshold))
        }
        setError(null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load profitability analytics")
      } finally {
        setLoading(false)
      }
    }

    void loadReport()
  }, [])

  const filteredRows = useMemo(() => {
    const rows = report?.rows || []
    const normalizedQuery = query.trim().toLowerCase()
    const startTime = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : null
    const endTime = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : null

    return rows
      .filter((row) => flowFilter === "all" || row.flowType === flowFilter)
      .filter((row) => realizedFilter === "all" || String(row.realized) === realizedFilter)
      .filter((row) => {
        const reference = getDateReference(row, dateField)
        if (!reference) {
          return !startTime && !endTime
        }

        const referenceTime = new Date(reference).getTime()
        if (!Number.isFinite(referenceTime)) {
          return false
        }

        if (startTime !== null && referenceTime < startTime) {
          return false
        }

        if (endTime !== null && referenceTime > endTime) {
          return false
        }

        return true
      })
      .filter((row) => {
        if (!normalizedQuery) {
          return true
        }

        return [
          row.orderId,
          row.traceId,
          row.serviceCategory,
          row.serviceReference,
          row.customerReference,
          row.recipientLabel,
          row.customerName,
          row.provider,
          row.pricingStrategy
        ].some((value) => typeof value === "string" && value.toLowerCase().includes(normalizedQuery))
      })
  }, [dateField, endDate, flowFilter, query, realizedFilter, report?.rows, startDate])

  const filteredSummary = useMemo(() => {
    const realizedRows = filteredRows.filter((row) => row.realized)

    return {
      totalOrders: filteredRows.length,
      realizedOrders: realizedRows.length,
      realizedNetMargin: sumNumbers(realizedRows.map((row) => row.netMargin)),
      expectedNetMargin: sumNumbers(filteredRows.map((row) => row.netMargin)),
      realizedGrossMargin: sumNumbers(realizedRows.map((row) => row.grossMargin)),
      totalOperatingCost: sumNumbers(filteredRows.map((row) => row.operatingCost))
    }
  }, [filteredRows])

  const stuckPaidRows = useMemo(() => {
    const manualBillingRows = filteredRows.filter((row) => row.flowType === "manual_billing")
    return getStuckPaidOrders(
      manualBillingRows.map((row) => ({
        ...row,
        id: row.orderId,
      })),
      stuckPaidThresholdMinutes
    )
  }, [filteredRows, stuckPaidThresholdMinutes])

  const aiInsights = useMemo(() => {
    const candidateRows = filteredRows.filter((row) => row.paymentMethod || row.userCountryCode || row.aiLocationCluster || getAiOptimization(row))
    const analysisRows = candidateRows.filter((row) => row.realized && typeof row.netMargin === "number")
    const rows = analysisRows.length > 0 ? analysisRows : candidateRows

    const clusterMap = new Map<string, { orders: number; netMarginTotal: number; marginPercentTotal: number; sampleCount: number; source: "static" | "learned" }>()
    const paymentMap = new Map<string, { orders: number; netMarginTotal: number; marginPercentTotal: number; sampleCount: number }>()
    const corridorMap = new Map<string, { orders: number; netMarginTotal: number; marginPercentTotal: number; sampleCount: number }>()

    for (const row of rows) {
      const netMargin = typeof row.netMargin === "number" ? row.netMargin : 0
      const marginPercent = typeof row.netMarginPercent === "number" ? row.netMarginPercent : null

      const clusterKey = getResolvedAiCluster(row)
      const clusterAggregate = clusterMap.get(clusterKey) ?? {
        orders: 0,
        netMarginTotal: 0,
        marginPercentTotal: 0,
        sampleCount: 0,
        source: getResolvedAiProfileSource(row)
      }
      clusterAggregate.orders += 1
      clusterAggregate.netMarginTotal += netMargin
      if (marginPercent !== null) {
        clusterAggregate.marginPercentTotal += marginPercent
        clusterAggregate.sampleCount += 1
      }
      clusterMap.set(clusterKey, clusterAggregate)

      const paymentKey = getResolvedPaymentMethod(row)
      const paymentAggregate = paymentMap.get(paymentKey) ?? { orders: 0, netMarginTotal: 0, marginPercentTotal: 0, sampleCount: 0 }
      paymentAggregate.orders += 1
      paymentAggregate.netMarginTotal += netMargin
      if (marginPercent !== null) {
        paymentAggregate.marginPercentTotal += marginPercent
        paymentAggregate.sampleCount += 1
      }
      paymentMap.set(paymentKey, paymentAggregate)

      const corridorKey = getCorridorLabel(row)
      const corridorAggregate = corridorMap.get(corridorKey) ?? { orders: 0, netMarginTotal: 0, marginPercentTotal: 0, sampleCount: 0 }
      corridorAggregate.orders += 1
      corridorAggregate.netMarginTotal += netMargin
      if (marginPercent !== null) {
        corridorAggregate.marginPercentTotal += marginPercent
        corridorAggregate.sampleCount += 1
      }
      corridorMap.set(corridorKey, corridorAggregate)
    }

    return {
      coverage: rows.length,
      learnedRows: rows.filter((row) => getResolvedAiProfileSource(row) === "learned").length,
      clusters: [...clusterMap.entries()]
        .map(([cluster, aggregate]) => ({
          cluster,
          source: aggregate.source,
          orders: aggregate.orders,
          totalNetMargin: aggregate.netMarginTotal,
          averageMarginPercent: aggregate.sampleCount > 0 ? aggregate.marginPercentTotal / aggregate.sampleCount : null
        }))
        .sort((left, right) => right.orders - left.orders || right.totalNetMargin - left.totalNetMargin)
        .slice(0, 5),
      paymentMethods: [...paymentMap.entries()]
        .map(([paymentMethod, aggregate]) => ({
          paymentMethod,
          orders: aggregate.orders,
          averageNetMargin: aggregate.orders > 0 ? aggregate.netMarginTotal / aggregate.orders : 0,
          averageMarginPercent: aggregate.sampleCount > 0 ? aggregate.marginPercentTotal / aggregate.sampleCount : null
        }))
        .sort((left, right) => (right.averageMarginPercent ?? 0) - (left.averageMarginPercent ?? 0) || right.averageNetMargin - left.averageNetMargin)
        .slice(0, 5),
      corridors: [...corridorMap.entries()]
        .map(([corridor, aggregate]) => ({
          corridor,
          orders: aggregate.orders,
          averageNetMargin: aggregate.orders > 0 ? aggregate.netMarginTotal / aggregate.orders : 0,
          averageMarginPercent: aggregate.sampleCount > 0 ? aggregate.marginPercentTotal / aggregate.sampleCount : null
        }))
        .sort((left, right) => (right.averageMarginPercent ?? 0) - (left.averageMarginPercent ?? 0) || right.averageNetMargin - left.averageNetMargin)
        .slice(0, 5)
    }
  }, [filteredRows])

  async function saveThreshold() {
    const nextThreshold = Number(thresholdInput)

    if (!Number.isFinite(nextThreshold) || nextThreshold <= 0) {
      setSettingsMessage("Threshold must be a positive number of minutes.")
      return
    }

    setSavingThreshold(true)
    setSettingsMessage(null)

    try {
      const response = await fetch("/api/internal/settings/manual-billing-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stuckPaidThresholdMinutes: nextThreshold
        })
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to update alert threshold")
      }

      const updatedThreshold = Number(payload.setting?.stuckPaidThresholdMinutes)
      if (Number.isFinite(updatedThreshold) && updatedThreshold > 0) {
        const normalizedThreshold = Math.floor(updatedThreshold)
        setStuckPaidThresholdMinutes(normalizedThreshold)
        setThresholdInput(String(normalizedThreshold))
      }

      setSettingsMessage("Alert threshold updated.")
    } catch (saveError) {
      setSettingsMessage(saveError instanceof Error ? saveError.message : "Unable to update alert threshold")
    } finally {
      setSavingThreshold(false)
    }
  }

  const stuckPaidOrderIds = useMemo(() => new Set(stuckPaidRows.map((row) => row.orderId)), [stuckPaidRows])

  const securityReviewRows = securityReport?.rows.filter((row) => row.status !== "ok") || []

  function downloadCsv() {
    if (filteredRows.length === 0) {
      return
    }

    const headers = [
      "flow_type",
      "order_id",
      "trace_id",
      "service_category",
      "service_reference",
      "status",
      "currency",
      "input_amount",
      "customer_price",
      "provider_cost",
      "net_margin",
      "net_margin_percent",
      "gross_margin",
      "gross_margin_percent",
      "operating_cost",
      "net_margin_after_fees",
      "payment_method",
      "user_country_code",
      "ai_location_cluster",
      "ai_profile_source",
      "provider",
      "pricing_strategy",
      "realized",
      "created_at",
      "updated_at",
      "realized_at",
      "customer_reference",
      "recipient_label",
      "customer_name",
      "customer_email",
      "failure_reason"
    ]

    const lines = [
      headers.join(","),
      ...filteredRows.map((row) => [
        row.flowType,
        row.orderId,
        row.traceId,
        row.serviceCategory,
        row.serviceReference,
        row.status,
        row.currency,
        row.inputAmount,
        row.customerPrice,
        row.providerCost,
        row.netMargin,
        row.netMarginPercent,
        row.grossMargin,
        row.grossMarginPercent,
        row.operatingCost,
        row.netMarginAfterFees,
        row.paymentMethod,
        row.userCountryCode,
        row.aiLocationCluster,
        row.aiProfileSource,
        row.provider,
        row.pricingStrategy,
        row.realized,
        row.createdAt,
        row.updatedAt,
        row.realizedAt,
        row.customerReference,
        row.recipientLabel,
        row.customerName,
        row.customerEmail,
        row.failureReason
      ].map(escapeCsvValue).join(","))
    ]

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = `profitability-${startDate || "all"}-to-${endDate || "all"}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(blobUrl)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#0b1f18_42%,#07120d_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/internal/manual-billing" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Manual billing queue
            </Link>
            <Link href="/internal/cie-readiness" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              CIE readiness
            </Link>
            <a href="/api/internal/security" target="_blank" rel="noreferrer" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Security JSON
            </a>
            <button onClick={() => window.location.reload()} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Refresh
            </button>
          </div>
        </div>

        <section className="grid gap-6 rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">Profitability control room</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">One internal analytics surface for JIT and manual billing unit economics.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/78">
              Operators can inspect realized margin, gross margin, fee drag, and operating-cost impact per order without jumping between JIT tables and manual billing records.
            </p>
          </div>
          <CoteDIvoireHeroPanel
            badge="Profitability ops"
            gradientClass="from-[#0F3B2E] via-[#145A46] to-[#1D7B5F]"
            imageSrcs={[
              ...coteDivoireVisualAssets.canalPlus,
              ...coteDivoireVisualAssets.ciePostpaid,
              ...coteDivoireVisualAssets.sodeci
            ]}
            imageAlt="Unified profitability dashboard cards"
            contextLabel="Côte d'Ivoire"
            wordmark="Afrisendiq"
            heightClassName="h-[20rem]"
          />
        </section>

        {loading ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">Loading profitability analytics...</div>
        ) : error ? (
          <div className="mt-8 rounded-[1.75rem] border border-rose-200/50 bg-rose-50 p-6 text-sm text-rose-900">{error}</div>
        ) : report ? (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[1.5rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Realized net margin</div>
                <div className="mt-3 text-3xl font-semibold">{filteredSummary.realizedNetMargin.toLocaleString()} XOF</div>
                <div className="mt-2 text-sm text-slate-600">Across {filteredSummary.realizedOrders} realized orders in the filtered set</div>
              </article>
              <article className="rounded-[1.5rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Expected net margin</div>
                <div className="mt-3 text-3xl font-semibold">{filteredSummary.expectedNetMargin.toLocaleString()} XOF</div>
                <div className="mt-2 text-sm text-slate-600">Expected across {filteredSummary.totalOrders} filtered orders</div>
              </article>
              <article className="rounded-[1.5rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Gross margin captured</div>
                <div className="mt-3 text-3xl font-semibold">{filteredSummary.realizedGrossMargin.toLocaleString()} XOF</div>
                <div className="mt-2 text-sm text-slate-600">Before operating-cost drag</div>
              </article>
              <article className="rounded-[1.5rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Operating cost load</div>
                <div className="mt-3 text-3xl font-semibold">{filteredSummary.totalOperatingCost.toLocaleString()} XOF</div>
                <div className="mt-2 text-sm text-slate-600">JIT and manual pricing reserve total</div>
              </article>
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-3">
              <article className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">AI clusters</div>
                    <h2 className="mt-2 text-2xl font-semibold">Location-profile mix</h2>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">
                    {aiInsights.learnedRows} learned / {aiInsights.coverage} covered
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-600">The optimizer now records whether each order used a learned or static location profile.</div>
                <div className="mt-5 space-y-3">
                  {aiInsights.clusters.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">No AI cluster data in the current filter window.</div>
                  ) : aiInsights.clusters.map((cluster) => (
                    <div key={cluster.cluster} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{cluster.cluster.replaceAll("_", " ")}</div>
                        <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${cluster.source === "learned" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                          {formatProfileSource(cluster.source)}
                        </div>
                      </div>
                      <div className="mt-2">{cluster.orders} orders · {cluster.totalNetMargin.toLocaleString()} XOF net margin</div>
                      <div>{formatPercent(cluster.averageMarginPercent)} average net margin</div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Payment rails</div>
                <h2 className="mt-2 text-2xl font-semibold">Average margin by method</h2>
                <div className="mt-4 space-y-3">
                  {aiInsights.paymentMethods.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">No payment-method context recorded in the current filter window.</div>
                  ) : aiInsights.paymentMethods.map((paymentMethod) => (
                    <div key={paymentMethod.paymentMethod} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{paymentMethod.paymentMethod.replaceAll("_", " ")}</div>
                        <div>{paymentMethod.orders} orders</div>
                      </div>
                      <div className="mt-2">{Math.round(paymentMethod.averageNetMargin).toLocaleString()} XOF average net margin</div>
                      <div>{formatPercent(paymentMethod.averageMarginPercent)} average net margin rate</div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Corridors</div>
                <h2 className="mt-2 text-2xl font-semibold">Best-performing origin corridors</h2>
                <div className="mt-4 space-y-3">
                  {aiInsights.corridors.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">No corridor data in the current filter window.</div>
                  ) : aiInsights.corridors.map((corridor) => (
                    <div key={corridor.corridor} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{corridor.corridor}</div>
                        <div>{corridor.orders} orders</div>
                      </div>
                      <div className="mt-2">{Math.round(corridor.averageNetMargin).toLocaleString()} XOF average net margin</div>
                      <div>{formatPercent(corridor.averageMarginPercent)} average net margin rate</div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">Operational alerts</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Manual billing orders stuck after payment</h2>
                </div>
                <div className="flex flex-wrap items-end gap-3 text-sm text-emerald-50/78">
                  <div>Threshold: {stuckPaidThresholdMinutes} minutes in paid status</div>
                  <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                    <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">Adjust</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={thresholdInput}
                      onChange={(event) => setThresholdInput(event.target.value)}
                      className="w-20 bg-transparent text-right text-sm text-white outline-none"
                    />
                  </label>
                  <button
                    onClick={saveThreshold}
                    disabled={savingThreshold}
                    className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingThreshold ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              <div className="mt-3 text-sm text-emerald-50/72">This threshold is stored server-side for internal ops screens.</div>

              {settingsMessage ? (
                <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{settingsMessage}</div>
              ) : null}

              {stuckPaidRows.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">No manual billing orders in the filtered set are stuck beyond the alert threshold.</div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {stuckPaidRows.map((row) => (
                    <div key={`profitability-stuck-${row.orderId}`} className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-[0_12px_40px_rgba(120,53,15,0.12)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{row.orderId}</div>
                          <div className="mt-1">{row.serviceCategory} · {row.recipientLabel}</div>
                        </div>
                        <div className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-950">
                          {row.ageMinutes} min waiting
                        </div>
                      </div>
                      <div className="mt-3">Updated {new Date(row.updatedAt).toLocaleString()}</div>
                      <div>Expected net margin {formatMoney(row.netMargin, row.currency)}</div>
                      <div>Customer {row.customerName || row.customerReference}{row.customerEmail ? ` · ${row.customerEmail}` : ""}</div>
                      <Link href="/internal/manual-billing" className="mt-4 inline-flex rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-950 transition hover:bg-amber-100">
                        Open manual billing queue
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Security diagnostics</div>
                    <h2 className="mt-2 text-2xl font-semibold">Remote RLS and grant posture</h2>
                  </div>
                  <div className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${(securityReport?.summary.reviewTables || 0) === 0 && (securityReport?.summary.missingTables || 0) === 0 ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                    {(securityReport?.summary.reviewTables || 0) === 0 && (securityReport?.summary.missingTables || 0) === 0 ? "healthy" : "review required"}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Protected tables</div>
                    <div className="mt-2 font-semibold">{securityReport?.summary.okTables || 0} / {securityReport?.summary.totalTables || 0}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Review flags</div>
                    <div className="mt-2 font-semibold">{securityReport?.summary.reviewTables || 0}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Generated</div>
                    <div className="mt-2 font-semibold">{securityReport?.generatedAt ? new Date(securityReport.generatedAt).toLocaleString() : "Unavailable"}</div>
                  </div>
                </div>
                {securityReviewRows.length > 0 ? (
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    {securityReviewRows.map((row) => (
                      <div key={row.tableName} className="rounded-2xl bg-amber-50 px-4 py-3">
                        <div className="font-semibold text-amber-950">{row.tableName}</div>
                        <div className="mt-1 text-amber-900">Status {row.status} · RLS {row.rowSecurityEnabled ? "enabled" : "disabled"} · Policies {row.policyCount}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Sensitive tables are locked down and the intentionally public catalog table is read-only.</div>
                )}
              </article>

              <article className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Reconciliation tools</div>
                <h2 className="mt-2 text-2xl font-semibold">Export and audit workflow</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">Use the date window and export only the filtered set for finance review, reconciliations, and spot checks against Stripe and provider settlement evidence.</p>
                <button
                  onClick={downloadCsv}
                  disabled={filteredRows.length === 0}
                  className="mt-5 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Export filtered CSV
                </button>
                <div className="mt-3 text-sm text-slate-600">{filteredRows.length} rows ready for export</div>
                <a href="/api/internal/security" target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Open security diagnostics JSON
                </a>
              </article>
            </section>

            <section className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">Filters</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Per-order margin inspection</h2>
                </div>
                <div className="text-sm text-emerald-50/78">{filteredRows.length} matching orders</div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order, trace, service, provider"
                  className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-emerald-50/45"
                />
                <select value={flowFilter} onChange={(event) => setFlowFilter(event.target.value)} className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white">
                  <option value="all">All flows</option>
                  <option value="jit">JIT</option>
                  <option value="manual_billing">Manual billing</option>
                </select>
                <select value={realizedFilter} onChange={(event) => setRealizedFilter(event.target.value)} className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white">
                  <option value="all">All realization states</option>
                  <option value="true">Realized only</option>
                  <option value="false">Unrealized only</option>
                </select>
                <select value={dateField} onChange={(event) => setDateField(event.target.value)} className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white">
                  <option value="created">Created date</option>
                  <option value="updated">Updated date</option>
                  <option value="realized">Realized date</option>
                </select>
                <div className="grid grid-cols-2 gap-4 xl:col-span-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white"
                  />
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {filteredRows.length === 0 ? (
                <article className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                  <div className="text-sm text-slate-700">No profitability rows match the current filters.</div>
                </article>
              ) : filteredRows.map((row) => (
                <article key={`${row.flowType}:${row.orderId}`} className={`rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)] ${stuckPaidOrderIds.has(row.orderId) ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{row.flowType.replaceAll("_", " ")}</div>
                      <h2 className="mt-2 text-2xl font-semibold">{row.orderId}</h2>
                      <div className="mt-2 text-sm text-slate-600">{row.serviceCategory} · {row.serviceReference}</div>
                    </div>
                    <div className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${row.realized ? "bg-emerald-100 text-emerald-900" : stuckPaidOrderIds.has(row.orderId) ? "bg-amber-100 text-amber-950" : "bg-amber-100 text-amber-900"}`}>
                      {row.realized ? "realized" : row.status.replaceAll("_", " ")}
                    </div>
                  </div>

                  {stuckPaidOrderIds.has(row.orderId) ? (
                    <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      Paid order alert: this manual billing order has remained in paid status for at least {stuckPaidThresholdMinutes} minutes and still needs operator progression.
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-4 md:grid-cols-2 text-sm text-slate-700">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recipient</div>
                      <div className="mt-2 font-semibold">{row.recipientLabel}</div>
                      <div>{row.customerReference}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Provider and strategy</div>
                      <div className="mt-2 font-semibold">{row.provider || "Unassigned"}</div>
                      <div>{row.pricingStrategy ? row.pricingStrategy.replaceAll("_", " ") : "No pricing strategy recorded"}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-700">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment rail</div>
                      <div className="mt-2 font-semibold">{getResolvedPaymentMethod(row).replaceAll("_", " ")}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Origin corridor</div>
                      <div className="mt-2 font-semibold">{getCorridorLabel(row)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">AI location profile</div>
                      <div className="mt-2 font-semibold">{getResolvedAiCluster(row).replaceAll("_", " ")}</div>
                      <div>{formatProfileSource(getResolvedAiProfileSource(row))}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-700">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Realized net margin</div>
                      <div className="mt-2 font-semibold">{formatMoney(row.netMargin, row.currency)}</div>
                      <div>{typeof row.netMarginPercent === "number" ? `${row.netMarginPercent.toFixed(2)}%` : "No percent recorded"}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Gross margin</div>
                      <div className="mt-2 font-semibold">{formatMoney(row.grossMargin, row.currency)}</div>
                      <div>{typeof row.grossMarginPercent === "number" ? `${row.grossMarginPercent.toFixed(2)}%` : "No percent recorded"}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Operating-cost impact</div>
                      <div className="mt-2 font-semibold">{formatMoney(row.operatingCost, row.currency)}</div>
                      <div>{formatMoney(row.netMarginAfterFees, row.currency)} after fees</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-700">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Input amount</div>
                      <div className="mt-2 font-semibold">{formatMoney(row.inputAmount, row.currency)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer price</div>
                      <div className="mt-2 font-semibold">{formatMoney(row.customerPrice, row.currency)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Provider cost</div>
                      <div className="mt-2 font-semibold">{formatMoney(row.providerCost, row.currency)}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-600">
                    <div>Created {new Date(row.createdAt).toLocaleString()}</div>
                    <div>Updated {new Date(row.updatedAt).toLocaleString()}</div>
                    {row.realizedAt ? <div>Realized {new Date(row.realizedAt).toLocaleString()}</div> : null}
                    {row.customerName ? <div>Customer {row.customerName}{row.customerEmail ? ` · ${row.customerEmail}` : ""}</div> : null}
                    {row.failureReason ? <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-rose-900">{row.failureReason}</div> : null}
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}