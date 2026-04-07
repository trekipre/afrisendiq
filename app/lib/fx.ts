type FxRatesPayload = {
  base_code?: string
  rates?: Record<string, number>
}

export type UsdRatesResult = {
  baseCode: string
  rates: Record<string, number>
  fetchedAt: string
  source: "live" | "cache" | "fallback"
  stale: boolean
}

const FX_API_URL = "https://open.er-api.com/v6/latest/USD"
const FX_CACHE_TTL_MS = 5 * 60 * 1000

let cachedRates: UsdRatesResult | null = null
let cacheExpiresAt = 0

export function resetUsdRatesCache() {
  cachedRates = null
  cacheExpiresAt = 0
}

function parseFallbackRate(envName: string, fallbackValue: number) {
  const parsed = Number(process.env[envName])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue
}

function getFallbackRates() {
  return {
    XOF: parseFallbackRate("FX_FALLBACK_XOF", 600),
    NGN: parseFallbackRate("FX_FALLBACK_NGN", 1500),
    GHS: parseFallbackRate("FX_FALLBACK_GHS", 15),
    KES: parseFallbackRate("FX_FALLBACK_KES", 130)
  }
}

function normalizeRates(payload: FxRatesPayload): UsdRatesResult {
  return {
    baseCode: payload.base_code || "USD",
    rates: payload.rates || {},
    fetchedAt: new Date().toISOString(),
    source: "live",
    stale: false
  }
}

export async function getUsdRates(): Promise<UsdRatesResult> {
  const now = Date.now()

  if (cachedRates && now < cacheExpiresAt) {
    return {
      ...cachedRates,
      source: "cache",
      stale: false
    }
  }

  try {
    const response = await fetch(FX_API_URL, {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store"
    })

    if (!response.ok) {
      throw new Error(`FX provider request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as FxRatesPayload

    if (!payload.rates || typeof payload.rates.XOF !== "number") {
      throw new Error("FX provider response did not include rates")
    }

    const normalized = normalizeRates(payload)
    cachedRates = normalized
    cacheExpiresAt = now + FX_CACHE_TTL_MS
    return normalized
  } catch {
    if (cachedRates) {
      return {
        ...cachedRates,
        source: "cache",
        stale: true
      }
    }

    return {
      baseCode: "USD",
      rates: getFallbackRates(),
      fetchedAt: new Date().toISOString(),
      source: "fallback",
      stale: true
    }
  }
}

export async function convertUsdAmount(amount: number, currencyCode = "XOF") {
  const normalizedCurrencyCode = currencyCode.trim().toUpperCase()
  const rates = await getUsdRates()
  const rate = rates.rates[normalizedCurrencyCode]

  if (!Number.isFinite(rate)) {
    throw new Error(`Unsupported currency code: ${normalizedCurrencyCode}`)
  }

  return {
    ...rates,
    currencyCode: normalizedCurrencyCode,
    rate,
    converted: amount * rate
  }
}

// ---------------------------------------------------------------------------
// FX Snapshot — adapter for the Profit Engine's getFxRate dependency
// ---------------------------------------------------------------------------

import type { FxRateSnapshot } from "./profitEngine"

/**
 * Returns an FxRateSnapshot compatible with the Profit Engine.
 * fromCurrency must be "USD" (the only base we fetch).
 */
export async function getFxSnapshot(
  fromCurrency: string,
  toCurrency: string
): Promise<FxRateSnapshot> {
  if (fromCurrency.toUpperCase() !== "USD") {
    throw new Error(`getFxSnapshot only supports USD as base, got ${fromCurrency}`)
  }

  const rates = await getUsdRates()
  const code = toCurrency.trim().toUpperCase()
  const rate = rates.rates[code]

  if (!Number.isFinite(rate)) {
    throw new Error(`No FX rate available for ${code}`)
  }

  return {
    pair: `${fromCurrency}_${code}`,
    rate,
    source: rates.source,
    fetchedAt: rates.fetchedAt
  }
}

// ---------------------------------------------------------------------------
// Corridor Rate Comparison
// ---------------------------------------------------------------------------

/**
 * Compare two settlement corridors (e.g. USD→XOF vs EUR→XOF) and return
 * the one that gives the customer a better effective rate.
 * Useful for diaspora payments where the customer can pay in EUR or USD.
 */
export async function getBestCorridor(
  corridors: string[],
  targetCurrency: string
): Promise<{ corridor: string; rate: number; source: string } | null> {
  const results: { corridor: string; rate: number; source: string }[] = []
  const rates = await getUsdRates()
  const target = targetCurrency.trim().toUpperCase()

  for (const base of corridors) {
    const baseUpper = base.trim().toUpperCase()
    if (baseUpper === "USD") {
      const rate = rates.rates[target]
      if (Number.isFinite(rate)) {
        results.push({ corridor: `USD_${target}`, rate, source: rates.source })
      }
    } else {
      // Cross-rate: e.g. EUR→XOF = USD→XOF / USD→EUR
      const baseRate = rates.rates[baseUpper]
      const targetRate = rates.rates[target]
      if (Number.isFinite(baseRate) && baseRate > 0 && Number.isFinite(targetRate)) {
        const crossRate = targetRate / baseRate
        results.push({ corridor: `${baseUpper}_${target}`, rate: crossRate, source: rates.source })
      }
    }
  }

  if (results.length === 0) return null
  // Best corridor = highest rate per unit of payment currency → more target currency per unit
  return results.reduce((best, r) => (r.rate > best.rate ? r : best))
}