"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { resolveLocalizedText, useCoteDIvoireLocale, type LocalizedText } from "@/app/components/CoteDIvoireLocale"

// ---------------------------------------------------------------------------
// Types (mirrors the API response)
// ---------------------------------------------------------------------------

type CorridorProduct = {
  id: string
  label: { fr: string; en: string }
  xofValue: number
  category: string
  emoji: string
  impact: { fr: string; en: string }
  corridorPrice: number
  formattedPrice: string
}

type CorridorData = {
  corridor: string
  symbol: string
  flag: string
  name: { fr: string; en: string }
  xofRate: number
  available: boolean
  heroProduct?: CorridorProduct
  products: CorridorProduct[]
}

type DiasporaPricingResponse = {
  success: boolean
  corridors: CorridorData[]
}

// ---------------------------------------------------------------------------
// Localized copy
// ---------------------------------------------------------------------------

const copy = {
  sectionEyebrow: {
    fr: "Tarifs diaspora",
    en: "Diaspora pricing"
  } satisfies LocalizedText,
  sectionTitle: {
    fr: "Pas besoin de dépenser beaucoup\npour faire plaisir à la famille.",
    en: "You don't have to spend a lot\nto make your family happy."
  } satisfies LocalizedText,
  sectionSubtitle: {
    fr: "Regardez combien ça coûte vraiment dans votre monnaie.",
    en: "See how little it really costs in your currency."
  } satisfies LocalizedText,
  startingFrom: {
    fr: "À partir de",
    en: "Starting from"
  } satisfies LocalizedText,
  yourFamily: {
    fr: "Votre famille reçoit",
    en: "Your family receives"
  } satisfies LocalizedText,
  sendNow: {
    fr: "Envoyer maintenant",
    en: "Send now"
  } satisfies LocalizedText,
  moreOptions: {
    fr: "Plus d'options",
    en: "More options"
  } satisfies LocalizedText,
  feesIncluded: {
    fr: "Tout compris — aucun frais caché",
    en: "All-inclusive — no hidden fees"
  } satisfies LocalizedText,
  loading: {
    fr: "Chargement des tarifs…",
    en: "Loading prices…"
  } satisfies LocalizedText,
  poweredBy: {
    fr: "Tarifs calculés en temps réel par notre moteur IA",
    en: "Prices calculated in real time by our AI engine"
  } satisfies LocalizedText,
  selectCorridor: {
    fr: "D'où envoyez-vous ?",
    en: "Where are you sending from?"
  } satisfies LocalizedText,
  xofLabel: {
    fr: "F CFA",
    en: "CFA"
  } satisfies LocalizedText
}

// ---------------------------------------------------------------------------
// Category → page route mapping
// ---------------------------------------------------------------------------

const categoryHref: Record<string, string> = {
  airtime: "/cote-divoire/phone-top-up",
  data: "/cote-divoire/data-top-up",
  electricity: "/cote-divoire/cie-prepaid",
  "gift-cards": "/cote-divoire/gift-cards"
}

// ---------------------------------------------------------------------------
// Corridor color themes (distinct visual identity per corridor)
// ---------------------------------------------------------------------------

const corridorThemes: Record<string, { ring: string; bg: string; accent: string; glow: string }> = {
  EUR: { ring: "ring-blue-400/40", bg: "bg-blue-500/15", accent: "text-blue-300", glow: "shadow-blue-500/20" },
  USD: { ring: "ring-emerald-400/40", bg: "bg-emerald-500/15", accent: "text-emerald-300", glow: "shadow-emerald-500/20" },
  CAD: { ring: "ring-red-400/40", bg: "bg-red-500/15", accent: "text-red-300", glow: "shadow-red-500/20" },
  GBP: { ring: "ring-purple-400/40", bg: "bg-purple-500/15", accent: "text-purple-300", glow: "shadow-purple-500/20" }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiasporaPricingShowcase() {
  const { locale } = useCoteDIvoireLocale()
  const [data, setData] = useState<CorridorData[] | null>(null)
  const [selectedCorridor, setSelectedCorridor] = useState<string>("EUR")
  const [expandedCorridor, setExpandedCorridor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/cote-divoire/diaspora-pricing")
        const json = (await res.json()) as DiasporaPricingResponse
        if (json.success && json.corridors) {
          setData(json.corridors)
        }
      } catch {
        // Graceful degradation — section just won't render
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const toggleExpand = useCallback(
    (corridor: string) => {
      setExpandedCorridor((prev) => (prev === corridor ? null : corridor))
    },
    []
  )

  if (loading) {
    return (
      <section className="mt-10">
        <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-8 py-16 backdrop-blur">
          <div className="flex items-center gap-3 text-emerald-200/60">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
            {resolveLocalizedText(copy.loading, locale)}
          </div>
        </div>
      </section>
    )
  }

  if (!data || data.length === 0) return null

  const activeCorridor = data.find((c) => c.corridor === selectedCorridor && c.available)
  const hero = activeCorridor?.heroProduct

  return (
    <section className="mt-10 animate-cardFade">
      {/* ── Section header ── */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {resolveLocalizedText(copy.sectionEyebrow, locale)}
        </div>
        <h2 className="mt-4 whitespace-pre-line text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl md:text-[2rem]">
          {resolveLocalizedText(copy.sectionTitle, locale)}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-emerald-100/60">
          {resolveLocalizedText(copy.sectionSubtitle, locale)}
        </p>
      </div>

      {/* ── Corridor selector tabs ── */}
      <div className="mb-6">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-emerald-200/50">
          {resolveLocalizedText(copy.selectCorridor, locale)}
        </p>
        <div className="flex justify-center gap-2">
          {data.filter((c) => c.available).map((c) => {
            const isActive = selectedCorridor === c.corridor
            const theme = corridorThemes[c.corridor] ?? corridorThemes.USD
            return (
              <button
                key={c.corridor}
                onClick={() => {
                  setSelectedCorridor(c.corridor)
                  setExpandedCorridor(null)
                }}
                className={`
                  flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300
                  ${isActive
                    ? `ring-2 ${theme.ring} ${theme.bg} text-white shadow-lg ${theme.glow}`
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  }
                `}
              >
                <span className="text-lg">{c.flag}</span>
                <span>{c.corridor}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Hero price card (the big psychological anchor) ── */}
      {hero && activeCorridor && (
        <div className="mx-auto mb-6 max-w-xl">
          <div className="group relative overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br from-white/12 to-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.3)] backdrop-blur-lg transition-all duration-500 hover:border-white/25 hover:shadow-[0_36px_100px_rgba(0,0,0,0.4)]">
            {/* Animated glow background */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl transition-all duration-700 group-hover:bg-emerald-400/15" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-blue-500/8 blur-3xl" />

            {/* Corridor flag + "Starting from" */}
            <div className="relative z-10 flex items-center gap-3">
              <span className="text-3xl">{activeCorridor.flag}</span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/60">
                  {resolveLocalizedText(copy.startingFrom, locale)}
                </div>
                <div className="text-xs text-white/40">
                  {resolveLocalizedText(activeCorridor.name, locale)}
                </div>
              </div>
            </div>

            {/* THE BIG PRICE — psychological anchor */}
            <div className="relative z-10 mt-5 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
                {hero.formattedPrice}
              </span>
            </div>

            {/* What the family gets */}
            <div className="relative z-10 mt-4 flex items-start gap-3 rounded-2xl bg-white/8 px-5 py-4">
              <span className="text-2xl">{hero.emoji}</span>
              <div>
                <div className="text-sm font-semibold text-white">
                  {resolveLocalizedText(copy.yourFamily, locale)}
                </div>
                <div className="mt-0.5 text-base font-bold text-emerald-300">
                  {resolveLocalizedText(hero.label, locale)}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {resolveLocalizedText(hero.impact, locale)}
                </div>
              </div>
            </div>

            {/* CTA button */}
            <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={categoryHref[hero.category] ?? "/cote-divoire/catalog"}
                className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0E2E23] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-xl"
              >
                {resolveLocalizedText(copy.sendNow, locale)} →
              </Link>
              <button
                onClick={() => toggleExpand(activeCorridor.corridor)}
                className="rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/12"
              >
                {resolveLocalizedText(copy.moreOptions, locale)}
              </button>
            </div>

            {/* All-inclusive badge */}
            <div className="relative z-10 mt-4 text-[11px] font-medium text-emerald-300/50">
              ✓ {resolveLocalizedText(copy.feesIncluded, locale)}
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded product grid (all products for the selected corridor) ── */}
      {expandedCorridor && activeCorridor && (
        <div className="mx-auto mb-6 max-w-3xl animate-cardFade">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeCorridor.products.map((product) => (
              <Link
                key={product.id}
                href={categoryHref[product.category] ?? "/cote-divoire/catalog"}
                className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/8 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{product.emoji}</span>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    {product.xofValue.toLocaleString()} {resolveLocalizedText(copy.xofLabel, locale)}
                  </span>
                </div>
                <div className="mt-3 text-sm font-medium text-white/80">
                  {resolveLocalizedText(product.label, locale)}
                </div>
                <div className="mt-1 text-xs text-white/40">
                  {resolveLocalizedText(product.impact, locale)}
                </div>
                <div className="mt-auto pt-3">
                  <span className="text-xl font-bold text-white">{product.formattedPrice}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 4-corridor quick comparison strip ── */}
      {hero && (
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.filter((c) => c.available).map((c) => {
              const cheapest = c.products.reduce(
                (min, p) => (p.corridorPrice < min.corridorPrice ? p : min),
                c.products[0]
              )
              if (!cheapest) return null
              const theme = corridorThemes[c.corridor] ?? corridorThemes.USD
              const isSelected = c.corridor === selectedCorridor
              return (
                <button
                  key={c.corridor}
                  onClick={() => {
                    setSelectedCorridor(c.corridor)
                    setExpandedCorridor(null)
                  }}
                  className={`
                    group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300
                    ${isSelected
                      ? `border-white/20 ${theme.bg} shadow-md ${theme.glow}`
                      : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6"
                    }
                  `}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{c.flag}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      {c.corridor}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {cheapest.formattedPrice}
                  </div>
                  <div className="text-[10px] text-white/40">
                    {resolveLocalizedText(copy.startingFrom, locale).toLowerCase()}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── AI engine badge ── */}
      <div className="mt-5 text-center">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-emerald-200/30">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {resolveLocalizedText(copy.poweredBy, locale)}
        </span>
      </div>
    </section>
  )
}
