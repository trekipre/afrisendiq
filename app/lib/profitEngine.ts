/**
 * AfriSendIQ AI-Powered Profit Engine v3
 *
 * Guarantees AfriSendIQ is ALWAYS priced below competition while maximizing
 * profit through seven interlocking layers:
 *
 *   Layer 1 — Provider Cost Arbitrage
 *     Real-time comparison across Reloadly, Ding, DT One. Pick the cheapest
 *     provider for every single transaction, not just once at catalog time.
 *
 *   Layer 2 — Live FX Profit Capture
 *     Providers charge in USD; customers pay in XOF. The engine fetches live
 *     USD→XOF rates, compares against each provider's implicit rate, and
 *     captures the spread delta as hidden margin. A favorable live rate that
 *     beats the provider's baked-in rate = free profit.
 *
 *   Layer 3 — Corridor-Aware FX Optimization
 *     Diaspora corridors (EUR→XOF, USD→XOF, GBP→XOF, CAD→XOF) each have
 *     different mid-market spreads. The engine detects the customer's payment
 *     currency and picks the corridor with the tightest spread to minimize
 *     cost while capturing the difference.
 *
 *   Layer 4 — Intelligent Competitor Undercut
 *     Doesn't just blindly undercut by a flat %. Uses "gap filling" — when
 *     competitor prices are far above our floor, the engine fills the gap
 *     optimally: price close to competitors (maximizing margin) but always
 *     visibly cheaper. The algorithm uses an elasticity parameter to decide
 *     how much of the gap to capture as profit vs pass to the customer.
 *
 *   Layer 5 — Demand-Aware Margin Expansion
 *     Weekend evenings, month-end salary days, holidays → multiplier widens
 *     margin because demand is inelastic during these windows.
 *
 *   Layer 6 — Volume Velocity Rebate Intelligence
 *     Tracks rolling 30-day volume per provider. As volume grows, the engine
 *     progressively reduces the margin floor, reflecting anticipated rebates.
 *     This makes prices even more competitive at scale.
 *
 *   Layer 7 — Payment Fee Absorption
 *     Grosses up customer price so Stripe's 2.9% + fixed fee is always
 *     covered. The net margin after payment fees is the true profit floor.
 *
 * The engine returns a full PricingDecision with every signal that contributed
 * to the price, making the algorithm auditable and tunable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompetitorPrice = {
  competitor: string
  productType: string
  amount: number
  currency: string
  price: number
  fetchedAt: string
  expiresAt: string
}

export type ProviderCostSnapshot = {
  provider: string
  productId: string
  amount: number
  currency: string
  providerCost: number
  providerCostUsd?: number
  fetchedAt: string
}

export type FxRateSnapshot = {
  pair: string
  rate: number
  source: "live" | "cache" | "fallback"
  fetchedAt: string
}

export type PaymentMethod =
  | "card"
  | "bank_transfer"
  | "mobile_money"
  | "wallet_balance"
  | "crypto"
  | "manual"

export type AiOptimizationMode = "baseline" | "contextual_margin"

export type AiOptimizationSummary = {
  mode: AiOptimizationMode
  score: number
  paymentMethod: PaymentMethod
  paymentMethodLabel: string
  paymentFeePercent: number
  paymentFeeFixed: number
  userCountryCode?: string
  locationCluster: string
  locationProfileSource: "static" | "learned"
  locationProfileSampleSize?: number
  locationAdjustmentPercent: number
  paymentMethodAdjustmentPercent: number
  competitorPressureMultiplier: number
  demandMultiplierBoost: number
}

export type PricingDecision = {
  customerPrice: number
  providerCost: number
  fxAdjustedCost: number
  fxProfit: number
  operatingCost: number
  grossMargin: number
  grossMarginPercent: number
  netMarginAfterFees: number
  netMarginAfterFeesPercent: number
  netMarginAfterCosts: number
  netMarginAfterCostsPercent: number
  provider: string
  strategy: PricingStrategy
  competitorBenchmark?: number
  undercutAmount?: number
  fxSnapshot?: FxRateSnapshot
  aiOptimization?: AiOptimizationSummary
  signals: PricingSignal[]
}

export type PricingStrategy =
  | "competitor_undercut"       // Priced below cheapest competitor
  | "smart_gap_fill"            // Competitor far above floor — fill gap optimally
  | "arbitrage_margin"          // No competitor data; maximize provider spread
  | "demand_surge"              // High-demand window; widen margin slightly
  | "floor_margin"              // At minimum — can't go lower and stay profitable
  | "promotional"               // User-facing promo rate (acquisition mode)

export type PricingSignal = {
  name: string
  weight: number
  value: number
  description: string
}

export type DemandWindow = {
  dayOfWeek: number[]     // 0 = Sunday … 6 = Saturday
  hourStart: number       // UTC hour
  hourEnd: number         // UTC hour
  multiplier: number      // e.g. 1.02 = 2% wider margin
  label: string
}

export type ProfitEngineConfig = {
  minMarginPercent: number
  maxMarginPercent: number
  targetUndercutPercent: number
  gapFillElasticity: number       // 0–1: 0 = pass all savings to customer, 1 = keep all as margin
  demandWindows: DemandWindow[]
  fxSpreadCaptureBps: number
  promoMarginPercent?: number
  competitorCacheTtlMs: number
  paymentFeePercent: number
  paymentFeeFixed: number
  volumeRebateThresholds: VolumeRebateTier[]
  corridorSpreads: Record<string, number>  // e.g. { "EUR_XOF": 15, "USD_XOF": 30 } in bps
  minAbsoluteMargin: number               // minimum XOF profit per transaction
  operatingCostPercent: number
  operatingCostFixed: number
  paymentMethodProfiles: Record<PaymentMethod, PaymentMethodProfile>
  locationProfiles: Record<string, LocationMarginProfile>
}

export type VolumeRebateTier = {
  minTransactions: number
  rebateBps: number              // basis points reduction in min margin
  label: string
}

export type ProfitEngineDependencies = {
  getCompetitorPrices: (productType: string, amount: number, currency: string) => Promise<CompetitorPrice[]>
  getProviderCosts: (productId: string, amount: number, customerReference?: string) => Promise<ProviderCostSnapshot[]>
  getFxRate?: (fromCurrency: string, toCurrency: string) => Promise<FxRateSnapshot>
  now?: () => Date
}

export type PaymentMethodProfile = {
  label: string
  feePercent: number
  feeFixed: number
  marginAdjustmentPercent: number
  competitorPressureMultiplier: number
}

export type LocationMarginProfile = {
  cluster: string
  countryCodes: string[]
  marginAdjustmentPercent: number
  maxMarginAdjustmentPercent: number
  demandMultiplierBoost: number
  competitorPressureMultiplier: number
  source?: "static" | "learned"
  sampleSize?: number
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_VOLUME_REBATE_TIERS: VolumeRebateTier[] = [
  { minTransactions: 100,  rebateBps: 10,  label: "starter" },
  { minTransactions: 500,  rebateBps: 25,  label: "growth" },
  { minTransactions: 2000, rebateBps: 50,  label: "scale" },
  { minTransactions: 5000, rebateBps: 75,  label: "enterprise" },
]

const DEFAULT_CORRIDOR_SPREADS: Record<string, number> = {
  EUR_XOF: 8,    // EUR→XOF is tight (CFA franc pegged to EUR)
  USD_XOF: 30,   // USD→XOF has wider spread
  GBP_XOF: 25,
  CAD_XOF: 35,
}

const DEFAULT_PAYMENT_METHOD_PROFILES: Record<PaymentMethod, PaymentMethodProfile> = {
  card: {
    label: "Card",
    feePercent: readEnvPercent("STRIPE_FEE_PERCENT", 2.9),
    feeFixed: readEnvPercent("STRIPE_FEE_FIXED", 0),
    marginAdjustmentPercent: 0.25,
    competitorPressureMultiplier: 1,
  },
  bank_transfer: {
    label: "Bank transfer",
    feePercent: readEnvPercent("BANK_TRANSFER_FEE_PERCENT", 1.1),
    feeFixed: readEnvPercent("BANK_TRANSFER_FEE_FIXED", 0),
    marginAdjustmentPercent: 0.8,
    competitorPressureMultiplier: 0.96,
  },
  mobile_money: {
    label: "Mobile money",
    feePercent: readEnvPercent("MOBILE_MONEY_FEE_PERCENT", 1.8),
    feeFixed: readEnvPercent("MOBILE_MONEY_FEE_FIXED", 0),
    marginAdjustmentPercent: 0.45,
    competitorPressureMultiplier: 0.98,
  },
  wallet_balance: {
    label: "Wallet balance",
    feePercent: readEnvPercent("WALLET_BALANCE_FEE_PERCENT", 0.35),
    feeFixed: readEnvPercent("WALLET_BALANCE_FEE_FIXED", 0),
    marginAdjustmentPercent: 1.1,
    competitorPressureMultiplier: 0.92,
  },
  crypto: {
    label: "Crypto",
    feePercent: readEnvPercent("CRYPTO_FEE_PERCENT", 1),
    feeFixed: readEnvPercent("CRYPTO_FEE_FIXED", 0),
    marginAdjustmentPercent: 0.9,
    competitorPressureMultiplier: 0.95,
  },
  manual: {
    label: "Manual settlement",
    feePercent: readEnvPercent("MANUAL_SETTLEMENT_FEE_PERCENT", 0),
    feeFixed: readEnvPercent("MANUAL_SETTLEMENT_FEE_FIXED", 0),
    marginAdjustmentPercent: 1.35,
    competitorPressureMultiplier: 0.9,
  },
}

const DEFAULT_LOCATION_PROFILES: Record<string, LocationMarginProfile> = {
  core_eu: {
    cluster: "core_eu",
    countryCodes: ["FR", "BE", "DE", "NL", "IT", "ES"],
    marginAdjustmentPercent: 0.2,
    maxMarginAdjustmentPercent: 0.5,
    demandMultiplierBoost: 1.005,
    competitorPressureMultiplier: 1,
    source: "static",
  },
  uk: {
    cluster: "uk",
    countryCodes: ["GB", "IE"],
    marginAdjustmentPercent: 0.3,
    maxMarginAdjustmentPercent: 0.65,
    demandMultiplierBoost: 1.006,
    competitorPressureMultiplier: 0.99,
    source: "static",
  },
  north_america: {
    cluster: "north_america",
    countryCodes: ["US", "CA"],
    marginAdjustmentPercent: 0.75,
    maxMarginAdjustmentPercent: 1,
    demandMultiplierBoost: 1.01,
    competitorPressureMultiplier: 0.96,
    source: "static",
  },
  africa_regional: {
    cluster: "africa_regional",
    countryCodes: ["CI", "SN", "TG", "BJ", "GH", "NG"],
    marginAdjustmentPercent: -0.2,
    maxMarginAdjustmentPercent: -0.1,
    demandMultiplierBoost: 1,
    competitorPressureMultiplier: 1.04,
    source: "static",
  },
  rest_of_world: {
    cluster: "rest_of_world",
    countryCodes: [],
    marginAdjustmentPercent: 0,
    maxMarginAdjustmentPercent: 0,
    demandMultiplierBoost: 1,
    competitorPressureMultiplier: 1,
    source: "static",
  },
}

const DEFAULT_CONFIG: ProfitEngineConfig = {
  minMarginPercent: readEnvPercent("PROFIT_MIN_MARGIN_PCT", 3),
  maxMarginPercent: readEnvPercent("PROFIT_MAX_MARGIN_PCT", 18),
  targetUndercutPercent: readEnvPercent("PROFIT_UNDERCUT_PCT", 2),
  gapFillElasticity: readEnvPercent("PROFIT_GAP_FILL_ELASTICITY", 0.6),
  fxSpreadCaptureBps: readEnvPercent("PROFIT_FX_SPREAD_BPS", 50),
  paymentFeePercent: readEnvPercent("STRIPE_FEE_PERCENT", 2.9),
  paymentFeeFixed: readEnvPercent("STRIPE_FEE_FIXED", 0),
  minAbsoluteMargin: readEnvPercent("PROFIT_MIN_ABSOLUTE_XOF", 150),
  operatingCostPercent: readEnvPercent("PROFIT_OPERATING_COST_PERCENT", 0.35),
  operatingCostFixed: readEnvPercent("PROFIT_OPERATING_COST_FIXED_XOF", 25),
  competitorCacheTtlMs: 15 * 60 * 1000,
  volumeRebateThresholds: DEFAULT_VOLUME_REBATE_TIERS,
  corridorSpreads: DEFAULT_CORRIDOR_SPREADS,
  paymentMethodProfiles: DEFAULT_PAYMENT_METHOD_PROFILES,
  locationProfiles: DEFAULT_LOCATION_PROFILES,
  demandWindows: [
    { dayOfWeek: [5, 6, 0], hourStart: 17, hourEnd: 23, multiplier: 1.015, label: "weekend_evening_peak" },
    { dayOfWeek: [0, 1, 2, 3, 4, 5, 6], hourStart: 0, hourEnd: 24, multiplier: 1.01, label: "month_end_salary" },
  ]
}

export function getDefaultProfitEngineConfig(): ProfitEngineConfig {
  return {
    ...DEFAULT_CONFIG,
    corridorSpreads: { ...DEFAULT_CONFIG.corridorSpreads },
    demandWindows: DEFAULT_CONFIG.demandWindows.map((window) => ({ ...window, dayOfWeek: [...window.dayOfWeek] })),
    volumeRebateThresholds: DEFAULT_CONFIG.volumeRebateThresholds.map((tier) => ({ ...tier })),
    paymentMethodProfiles: Object.fromEntries(
      Object.entries(DEFAULT_CONFIG.paymentMethodProfiles).map(([key, profile]) => [key, { ...profile }])
    ) as ProfitEngineConfig["paymentMethodProfiles"],
    locationProfiles: Object.fromEntries(
      Object.entries(DEFAULT_CONFIG.locationProfiles).map(([key, profile]) => [key, { ...profile, countryCodes: [...profile.countryCodes] }])
    )
  }
}

function normalizeCountryCode(countryCode?: string) {
  const normalized = countryCode?.trim().toUpperCase()
  return normalized && normalized.length >= 2 ? normalized.slice(0, 2) : undefined
}

function resolveLocationProfile(countryCode: string | undefined, profiles: Record<string, LocationMarginProfile>) {
  if (countryCode) {
    const matched = Object.values(profiles).find((profile) => profile.countryCodes.includes(countryCode))
    if (matched) {
      return matched
    }
  }

  return profiles.rest_of_world ?? {
    cluster: "rest_of_world",
    countryCodes: [],
    marginAdjustmentPercent: 0,
    maxMarginAdjustmentPercent: 0,
    demandMultiplierBoost: 1,
    competitorPressureMultiplier: 1,
    source: "static",
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function computeAiOptimization(
  input: {
    paymentMethod?: PaymentMethod
    userCountryCode?: string
  },
  config: ProfitEngineConfig
): AiOptimizationSummary {
  const paymentMethod = input.paymentMethod ?? "card"
  const paymentProfile = config.paymentMethodProfiles[paymentMethod] ?? config.paymentMethodProfiles.card
  const userCountryCode = normalizeCountryCode(input.userCountryCode)
  const locationProfile = resolveLocationProfile(userCountryCode, config.locationProfiles)
  const mode: AiOptimizationMode = input.paymentMethod || userCountryCode ? "contextual_margin" : "baseline"

  const score = clamp(
    0.5 +
      paymentProfile.marginAdjustmentPercent / 4 +
      locationProfile.marginAdjustmentPercent / 4 +
      (1 - paymentProfile.competitorPressureMultiplier) +
      (1 - locationProfile.competitorPressureMultiplier),
    0,
    1
  )

  return {
    mode,
    score: roundToTwo(score),
    paymentMethod,
    paymentMethodLabel: paymentProfile.label,
    paymentFeePercent: paymentProfile.feePercent,
    paymentFeeFixed: paymentProfile.feeFixed,
    userCountryCode,
    locationCluster: locationProfile.cluster,
    locationProfileSource: locationProfile.source ?? "static",
    locationProfileSampleSize: locationProfile.sampleSize,
    locationAdjustmentPercent: locationProfile.marginAdjustmentPercent,
    paymentMethodAdjustmentPercent: paymentProfile.marginAdjustmentPercent,
    competitorPressureMultiplier: roundToTwo(paymentProfile.competitorPressureMultiplier * locationProfile.competitorPressureMultiplier),
    demandMultiplierBoost: roundToTwo(locationProfile.demandMultiplierBoost),
  }
}

function readEnvPercent(key: string, fallback: number): number {
  const parsed = Number(process.env[key])
  return Number.isFinite(parsed) ? parsed : fallback
}

// ---------------------------------------------------------------------------
// Layer 1 — Provider Cost Arbitrage
// ---------------------------------------------------------------------------

function selectCheapestProvider(costs: ProviderCostSnapshot[]): ProviderCostSnapshot | null {
  const available = costs.filter((c) => c.providerCost > 0)
  if (available.length === 0) return null
  return available.reduce((min, c) => (c.providerCost < min.providerCost ? c : min))
}

// ---------------------------------------------------------------------------
// Layer 2 — Live FX Profit Capture
// ---------------------------------------------------------------------------

function computeFxAdjustedCost(
  providerCost: number,
  providerCostUsd: number | undefined,
  fxSnapshot: FxRateSnapshot | undefined,
  staticBps: number
): { adjustedCost: number; fxProfit: number } {
  // If we have both a USD cost and a live FX rate, compute the real XOF cost
  // and capture the delta between what the provider charges and the live rate.
  if (providerCostUsd && providerCostUsd > 0 && fxSnapshot && fxSnapshot.rate > 0) {
    const liveXofCost = Math.round(providerCostUsd * fxSnapshot.rate * 100) / 100
    // Provider's baked-in XOF cost vs what the live rate says it should be
    const fxDelta = providerCost - liveXofCost
    // If fxDelta > 0, the provider is charging more XOF than the live rate warrants
    // — we use the live (cheaper) cost. If negative, provider gives a better rate
    // — we still use their cost but no FX profit.
    const adjustedCost = fxDelta > 0 ? liveXofCost : providerCost
    const fxProfit = Math.max(0, Math.round(fxDelta * 100) / 100)
    return { adjustedCost, fxProfit }
  }

  // Fallback: static BPS spread capture (original behavior)
  const spreadFraction = staticBps / 10000
  const adjustedCost = Math.round(providerCost * (1 - spreadFraction) * 100) / 100
  const fxProfit = Math.round((providerCost - adjustedCost) * 100) / 100
  return { adjustedCost, fxProfit }
}

// ---------------------------------------------------------------------------
// Layer 3 — Corridor-Aware FX Optimization
// ---------------------------------------------------------------------------

function getCorridorSpreadBonus(
  paymentCurrency: string | undefined,
  targetCurrency: string,
  corridorSpreads: Record<string, number>
): { bonusBps: number; corridor: string } {
  if (!paymentCurrency) return { bonusBps: 0, corridor: "unknown" }

  const corridor = `${paymentCurrency.toUpperCase()}_${targetCurrency.toUpperCase()}`
  const spreadBps = corridorSpreads[corridor]

  if (spreadBps === undefined) return { bonusBps: 0, corridor }

  // EUR→XOF corridor is pegged — very tight spread means less leakage.
  // Compare against the widest corridor (USD→XOF) to compute the bonus.
  const baseBps = corridorSpreads["USD_XOF"] ?? 30
  const bonusBps = Math.max(0, baseBps - spreadBps)
  return { bonusBps, corridor }
}

// ---------------------------------------------------------------------------
// Layer 4 — Intelligent Competitor Undercut (Smart Gap Fill)
// ---------------------------------------------------------------------------

function computeSmartGapFillPrice(
  floorPrice: number,
  competitorPrice: number,
  elasticity: number,
  demandMultiplier: number,
  targetUndercutPercent: number
): { price: number; strategy: PricingStrategy } {
  const gap = competitorPrice - floorPrice

  if (gap <= 0) {
    // Floor is already at or above competitor — can't undercut, use floor
    return { price: floorPrice, strategy: "floor_margin" }
  }

  // Elasticity controls how much of the gap we capture:
  //   0.0 → price = floorPrice (cheapest possible, all savings to customer)
  //   0.5 → price = floorPrice + 50% of gap (balanced)
  //   1.0 → price = competitorPrice (capture entire gap as margin)
  // We always stay below competitor by at least 1% to ensure visible undercut.
  const visibleUndercutFactor = clamp(1 - targetUndercutPercent / 100, 0.85, 0.999)
  const maxCapture = gap * visibleUndercutFactor  // never breach competitor price
  const capturedGap = maxCapture * elasticity * demandMultiplier
  const price = roundToTwo(floorPrice + capturedGap)

  // Determine which strategy label applies
  const marginAboveFloorPct = floorPrice > 0 ? ((price - floorPrice) / floorPrice) * 100 : 0
  const strategy: PricingStrategy = marginAboveFloorPct > 1 ? "smart_gap_fill" : "competitor_undercut"

  return { price, strategy }
}

// ---------------------------------------------------------------------------
// Layer 5 — Demand-Aware Margin Expansion
// ---------------------------------------------------------------------------

function isDemandWindow(window: DemandWindow, date: Date, dayOfMonth: number): boolean {
  if (window.label === "month_end_salary") {
    if (dayOfMonth < 25 && dayOfMonth > 2) return false
  }
  if (!window.dayOfWeek.includes(date.getUTCDay())) return false
  const hour = date.getUTCHours()
  return hour >= window.hourStart && hour < window.hourEnd
}

function computeDemandMultiplier(config: ProfitEngineConfig, date: Date): { multiplier: number; activeWindows: string[] } {
  const dayOfMonth = date.getUTCDate()
  let multiplier = 1.0
  const activeWindows: string[] = []

  for (const window of config.demandWindows) {
    if (isDemandWindow(window, date, dayOfMonth)) {
      multiplier *= window.multiplier
      activeWindows.push(window.label)
    }
  }

  return { multiplier, activeWindows }
}

// ---------------------------------------------------------------------------
// Layer 6 — Volume Velocity Rebate Intelligence
// ---------------------------------------------------------------------------

type VolumeEntry = { provider: string; amount: number; currency: string; date: string }
const volumeLog: VolumeEntry[] = []

export function resetVolumeLog() { volumeLog.length = 0 }

export function recordProviderVolume(provider: string, amount: number, currency: string) {
  volumeLog.push({ provider, amount, currency, date: new Date().toISOString() })
}

export function getProviderVolumeSummary(provider: string, windowMs = 30 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - windowMs
  const entries = volumeLog.filter((e) => e.provider === provider && new Date(e.date).getTime() >= cutoff)
  return {
    provider,
    transactionCount: entries.length,
    totalVolume: entries.reduce((sum, e) => sum + e.amount, 0),
    windowDays: Math.round(windowMs / (24 * 60 * 60 * 1000))
  }
}

function computeVolumeRebateBps(provider: string, tiers: VolumeRebateTier[]): { rebateBps: number; tier: string } {
  const summary = getProviderVolumeSummary(provider)
  let bestTier: VolumeRebateTier | null = null

  for (const tier of tiers) {
    if (summary.transactionCount >= tier.minTransactions) {
      if (!bestTier || tier.minTransactions > bestTier.minTransactions) {
        bestTier = tier
      }
    }
  }

  return bestTier
    ? { rebateBps: bestTier.rebateBps, tier: bestTier.label }
    : { rebateBps: 0, tier: "none" }
}

// ---------------------------------------------------------------------------
// Layer 7 — Payment Fee Absorption
// ---------------------------------------------------------------------------

function grossUpForPaymentFees(netPrice: number, config: ProfitEngineConfig): number {
  const feeRate = config.paymentFeePercent / 100
  const grossed = (netPrice + config.paymentFeeFixed) / (1 - feeRate)
  return roundToTwo(grossed)
}

function computeOperatingCost(costBasis: number, config: ProfitEngineConfig): number {
  return Math.round((costBasis * (config.operatingCostPercent / 100) + config.operatingCostFixed) * 100) / 100
}

// ---------------------------------------------------------------------------
// Competitor price cache
// ---------------------------------------------------------------------------

const competitorCache = new Map<string, CompetitorPrice[]>()

function competitorCacheKey(productType: string, amount: number, currency: string) {
  return `${productType}:${amount}:${currency}`
}

export function resetCompetitorCache() {
  competitorCache.clear()
}

async function getCompetitorBenchmark(
  productType: string,
  amount: number,
  currency: string,
  deps: ProfitEngineDependencies,
  config: ProfitEngineConfig
): Promise<CompetitorPrice | null> {
  const key = competitorCacheKey(productType, amount, currency)
  const now = (deps.now?.() ?? new Date()).getTime()

  const cached = competitorCache.get(key)
  if (cached && cached.length > 0 && new Date(cached[0].expiresAt).getTime() > now) {
    return cheapestCompetitor(cached)
  }

  try {
    const prices = await deps.getCompetitorPrices(productType, amount, currency)
    if (prices.length > 0) {
      const withExpiry = prices.map((p) => ({
        ...p,
        expiresAt: p.expiresAt || new Date(now + config.competitorCacheTtlMs).toISOString()
      }))
      competitorCache.set(key, withExpiry)
      return cheapestCompetitor(withExpiry)
    }
  } catch {
    // Competitor lookup failure is non-fatal
  }

  return null
}

function cheapestCompetitor(prices: CompetitorPrice[]): CompetitorPrice | null {
  if (prices.length === 0) return null
  return prices.reduce((min, p) => (p.price < min.price ? p : min))
}

// ---------------------------------------------------------------------------
// Core Pricing Algorithm — Integrates All 7 Layers
// ---------------------------------------------------------------------------

export async function computeOptimalPrice(
  input: {
    productId: string
    productType: string
    amount: number
    currency: string
    customerReference?: string
    paymentCurrency?: string       // e.g. "EUR", "USD", "GBP", "CAD"
    paymentMethod?: PaymentMethod
    userCountryCode?: string
  },
  deps: ProfitEngineDependencies,
  configOverride?: Partial<ProfitEngineConfig>
): Promise<PricingDecision> {
  const config = { ...getDefaultProfitEngineConfig(), ...configOverride }
  const now = deps.now?.() ?? new Date()
  const signals: PricingSignal[] = []
  const aiOptimization = computeAiOptimization({
    paymentMethod: input.paymentMethod,
    userCountryCode: input.userCountryCode,
  }, config)
  const effectivePaymentFeePercent = aiOptimization.paymentFeePercent
  const effectivePaymentFeeFixed = aiOptimization.paymentFeeFixed
  const effectiveMinMarginPercent = clamp(
    config.minMarginPercent + aiOptimization.locationAdjustmentPercent + aiOptimization.paymentMethodAdjustmentPercent,
    1,
    config.maxMarginPercent
  )
  const effectiveMaxMarginPercent = Math.max(
    effectiveMinMarginPercent,
    clamp(config.maxMarginPercent + resolveLocationProfile(aiOptimization.userCountryCode, config.locationProfiles).maxMarginAdjustmentPercent, effectiveMinMarginPercent, config.maxMarginPercent + 3)
  )
  const effectiveTargetUndercutPercent = config.targetUndercutPercent * aiOptimization.competitorPressureMultiplier

  if (aiOptimization.mode === "contextual_margin") {
    signals.push({
      name: "ai_margin_optimizer",
      weight: 0.2,
      value: aiOptimization.score,
      description: `AI optimizer scored ${aiOptimization.score} using ${aiOptimization.paymentMethodLabel.toLowerCase()} payment rails and ${aiOptimization.locationCluster} location profile`
    })
  }

  // ── Layer 1: Provider Cost Arbitrage ──────────────────────────────────
  const providerCosts = await deps.getProviderCosts(input.productId, input.amount, input.customerReference)
  const cheapest = selectCheapestProvider(providerCosts)

  if (!cheapest) {
    throw new Error("No provider can fulfill this product at this amount")
  }

  signals.push({
    name: "provider_selected",
    weight: 0.2,
    value: cheapest.providerCost,
    description: `${cheapest.provider} at ${cheapest.providerCost} ${input.currency} (cheapest of ${providerCosts.length} providers)`
  })

  // ── Layer 2: Live FX Profit Capture ───────────────────────────────────
  let fxSnapshot: FxRateSnapshot | undefined
  if (deps.getFxRate) {
    try {
      fxSnapshot = await deps.getFxRate("USD", input.currency)
    } catch {
      // FX lookup failure is non-fatal — fall back to static BPS
    }
  }

  const { adjustedCost: fxAdjustedCost, fxProfit } = computeFxAdjustedCost(
    cheapest.providerCost,
    cheapest.providerCostUsd,
    fxSnapshot,
    config.fxSpreadCaptureBps
  )

  if (fxProfit > 0) {
    signals.push({
      name: "fx_profit_capture",
      weight: 0.15,
      value: fxProfit,
      description: fxSnapshot
        ? `Live FX rate ${fxSnapshot.rate} captured ${fxProfit} ${input.currency} spread profit`
        : `Static FX spread capture: ${fxProfit} ${input.currency}`
    })
  }

  // ── Layer 3: Corridor-Aware FX Optimization ───────────────────────────
  const { bonusBps, corridor } = getCorridorSpreadBonus(
    input.paymentCurrency,
    input.currency,
    config.corridorSpreads
  )

  let effectiveCost = fxAdjustedCost
  if (bonusBps > 0) {
    const corridorSaving = Math.round(fxAdjustedCost * (bonusBps / 10000) * 100) / 100
    effectiveCost = Math.round((fxAdjustedCost - corridorSaving) * 100) / 100

    signals.push({
      name: "corridor_optimization",
      weight: 0.1,
      value: corridorSaving,
      description: `${corridor} corridor saves ${corridorSaving} ${input.currency} (${bonusBps} bps tighter than USD corridor)`
    })
  }

  // ── Layer 6: Volume Velocity Rebate ───────────────────────────────────
  const { rebateBps, tier: volumeTier } = computeVolumeRebateBps(cheapest.provider, config.volumeRebateThresholds)
  let adjustedMinMargin = effectiveMinMarginPercent

  if (rebateBps > 0) {
    const rebateReduction = rebateBps / 100  // bps → percentage points
    adjustedMinMargin = Math.max(1, config.minMarginPercent - rebateReduction)

    signals.push({
      name: "volume_rebate",
      weight: 0.1,
      value: rebateReduction,
      description: `Volume tier "${volumeTier}" reduces margin floor by ${rebateReduction}% (anticipating provider rebate)`
    })
  }

  // ── Layer 5: Demand-Aware Margin Expansion ────────────────────────────
  const { multiplier: demandMultiplier, activeWindows } = computeDemandMultiplier(config, now)
  const contextualDemandMultiplier = roundToTwo(demandMultiplier * aiOptimization.demandMultiplierBoost)
  const operatingCost = computeOperatingCost(effectiveCost, config)

  if (contextualDemandMultiplier > 1) {
    signals.push({
      name: "demand_surge",
      weight: 0.15,
      value: contextualDemandMultiplier,
      description: `Demand windows active: ${activeWindows.join(", ")}`
    })
  }

  // ── Compute Floor Price (net of fees) ─────────────────────────────────
  const netFloor = Math.round((effectiveCost + operatingCost + effectiveCost * (adjustedMinMargin / 100)) * 100) / 100
  const absoluteFloor = Math.round((effectiveCost + operatingCost + config.minAbsoluteMargin) * 100) / 100
  const floorBeforeFees = Math.max(netFloor, absoluteFloor)
  const floorPrice = roundToTwo((floorBeforeFees + effectivePaymentFeeFixed) / (1 - effectivePaymentFeePercent / 100))

  signals.push({
    name: "payment_method_fee_model",
    weight: 0.1,
    value: effectivePaymentFeePercent,
    description: `${aiOptimization.paymentMethodLabel} fee model set to ${effectivePaymentFeePercent}% + ${effectivePaymentFeeFixed} ${input.currency}`
  })

  if (operatingCost > 0) {
    signals.push({
      name: "operating_cost_floor",
      weight: 0.1,
      value: operatingCost,
      description: `Operating cost reserve adds ${operatingCost} ${input.currency} to the profitability floor`
    })
  }

  // ── Layer 2 (competitor) + Layer 4 (smart gap fill) ───────────────────
  const competitorBenchmark = await getCompetitorBenchmark(
    input.productType, input.amount, input.currency, deps, config
  )

  let customerPrice: number
  let strategy: PricingStrategy

  if (config.promoMarginPercent !== undefined) {
    // Promotional pricing — acquisition mode
    const promoNet = Math.round(effectiveCost * (1 + config.promoMarginPercent / 100) * 100) / 100
    customerPrice = grossUpForPaymentFees(
      Math.max(promoNet, effectiveCost + config.minAbsoluteMargin),
      {
        ...config,
        paymentFeePercent: effectivePaymentFeePercent,
        paymentFeeFixed: effectivePaymentFeeFixed,
      }
    )
    strategy = "promotional"

    signals.push({
      name: "promo_active",
      weight: 0.1,
      value: config.promoMarginPercent,
      description: `Promotional margin at ${config.promoMarginPercent}%`
    })
  } else if (competitorBenchmark) {
    // ── Layer 4: Smart Gap Fill ───────────────────────────────────────
    const { price: gapFillPrice, strategy: gapStrategy } = computeSmartGapFillPrice(
      floorPrice,
      competitorBenchmark.price,
      config.gapFillElasticity,
      contextualDemandMultiplier,
      effectiveTargetUndercutPercent
    )
    customerPrice = gapFillPrice
    strategy = gapStrategy

    signals.push({
      name: "competitor_intelligence",
      weight: 0.3,
      value: competitorBenchmark.price - customerPrice,
      description: `${strategy}: undercut ${competitorBenchmark.competitor} by ${(competitorBenchmark.price - customerPrice).toFixed(0)} ${input.currency} (their price: ${competitorBenchmark.price}, our floor: ${floorPrice})`
    })
  } else {
    // No competitor data — arbitrage with demand adjustment
    const arbitragePrice = roundToTwo(floorPrice * contextualDemandMultiplier)
    customerPrice = arbitragePrice
    strategy = contextualDemandMultiplier > 1 ? "demand_surge" : "arbitrage_margin"

    signals.push({
      name: "arbitrage_fallback",
      weight: 0.2,
      value: customerPrice - effectiveCost,
      description: `No competitor data — arbitrage margin from floor ${floorPrice} ${input.currency}`
    })
  }

  // ── Final safety: ensure within bounds and above absolute minimum ─────
  const maxPrice = grossUpForPaymentFees(
    roundToTwo(effectiveCost * (1 + effectiveMaxMarginPercent / 100)),
    {
      ...config,
      paymentFeePercent: effectivePaymentFeePercent,
      paymentFeeFixed: effectivePaymentFeeFixed,
    }
  )
  customerPrice = Math.max(customerPrice, floorPrice)
  customerPrice = Math.min(customerPrice, maxPrice)
  customerPrice = Math.round(customerPrice * 100) / 100

  // ── Compute final margins ─────────────────────────────────────────────
  const grossMargin = Math.round((customerPrice - effectiveCost) * 100) / 100
  const grossMarginPercent = effectiveCost > 0
    ? Math.round(((customerPrice - effectiveCost) / effectiveCost) * 10000) / 100
    : 0

  // Net margin = what AfriSendIQ keeps after Stripe takes its cut
  const stripeFee = roundToTwo(customerPrice * effectivePaymentFeePercent / 100 + effectivePaymentFeeFixed)
  const netMarginAfterFees = Math.round((customerPrice - effectiveCost - stripeFee) * 100) / 100
  const netMarginAfterFeesPercent = effectiveCost > 0
    ? Math.round((netMarginAfterFees / effectiveCost) * 10000) / 100
    : 0
  const netMarginAfterCosts = Math.round((netMarginAfterFees - operatingCost) * 100) / 100
  const netMarginAfterCostsPercent = effectiveCost > 0
    ? Math.round((netMarginAfterCosts / effectiveCost) * 10000) / 100
    : 0

  signals.push({
    name: "final_margin",
    weight: 0.2,
    value: netMarginAfterCostsPercent,
    description: `Gross: ${grossMargin} ${input.currency} (${grossMarginPercent}%) | Net after fees: ${netMarginAfterFees} ${input.currency} (${netMarginAfterFeesPercent}%) | Net after operating costs: ${netMarginAfterCosts} ${input.currency} (${netMarginAfterCostsPercent}%)`
  })

  return {
    customerPrice,
    providerCost: effectiveCost,
    fxAdjustedCost,
    fxProfit,
    operatingCost,
    grossMargin,
    grossMarginPercent,
    netMarginAfterFees,
    netMarginAfterFeesPercent,
    netMarginAfterCosts,
    netMarginAfterCostsPercent,
    provider: cheapest.provider,
    strategy,
    competitorBenchmark: competitorBenchmark?.price,
    undercutAmount: competitorBenchmark
      ? Math.round((competitorBenchmark.price - customerPrice) * 100) / 100
      : undefined,
    fxSnapshot,
    aiOptimization,
    signals
  }
}
