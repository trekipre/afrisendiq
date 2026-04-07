import {
  computeOptimalPrice,
  recordProviderVolume,
  getProviderVolumeSummary,
  resetCompetitorCache,
  resetVolumeLog,
  type ProfitEngineDependencies,
  type ProfitEngineConfig,
  type CompetitorPrice,
  type FxRateSnapshot
} from "@/app/lib/profitEngine"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockDeps(overrides?: Partial<ProfitEngineDependencies>): ProfitEngineDependencies {
  return {
    getCompetitorPrices: async () => [],
    getProviderCosts: async () => [
      { provider: "reloadly", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 950, providerCostUsd: 1.58, fetchedAt: new Date().toISOString() },
      { provider: "ding", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 970, providerCostUsd: 1.62, fetchedAt: new Date().toISOString() }
    ],
    now: () => new Date("2025-01-15T12:00:00Z"), // Wednesday mid-day (no demand window)
    ...overrides
  }
}

const defaultOverrides: Partial<ProfitEngineConfig> = {
  minAbsoluteMargin: 0 // disable for tests unless explicitly needed
}

// ---------------------------------------------------------------------------
// Layer 1 — Provider Cost Arbitrage
// ---------------------------------------------------------------------------

describe("Profit Engine — Layer 1: Provider Cost Arbitrage", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("selects the cheapest provider via arbitrage", async () => {
    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps(),
      defaultOverrides
    )

    expect(result.provider).toBe("reloadly") // 950 < 970
    expect(result.strategy).toBe("arbitrage_margin")
    expect(result.grossMargin).toBeGreaterThan(0)
    expect(result.grossMarginPercent).toBeGreaterThanOrEqual(3)
    expect(result.grossMarginPercent).toBeLessThanOrEqual(18)
  })

  it("selects ding when reloadly is more expensive", async () => {
    const deps = mockDeps({
      getProviderCosts: async () => [
        { provider: "reloadly", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 980, fetchedAt: new Date().toISOString() },
        { provider: "ding", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 940, fetchedAt: new Date().toISOString() },
        { provider: "dtone", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 960, fetchedAt: new Date().toISOString() }
      ]
    })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      defaultOverrides
    )

    expect(result.provider).toBe("ding")
  })

  it("throws when no provider can fulfill the product", async () => {
    const deps = mockDeps({ getProviderCosts: async () => [] })

    await expect(
      computeOptimalPrice(
        { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
        deps,
        defaultOverrides
      )
    ).rejects.toThrow("No provider can fulfill")
  })
})

// ---------------------------------------------------------------------------
// Layer 2 — Live FX Profit Capture
// ---------------------------------------------------------------------------

describe("Profit Engine — Layer 2: Live FX Profit Capture", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("captures FX spread when live rate is more favorable than provider rate", async () => {
    // Provider charges 950 XOF for something that costs $1.58 USD.
    // That implies a provider rate of ~601 XOF/USD.
    // Live rate is 610 XOF/USD → live XOF cost = 1.58 × 610 = 963.80
    // Since provider charges 950 < 963.80, the provider's rate is actually better.
    // So let's flip: provider charges 980, USD cost 1.58, live rate 610 → liveXof = 963.80
    // 980 - 963.80 = 16.20 XOF FX profit captured.
    const fxSnapshot: FxRateSnapshot = {
      pair: "USD_XOF",
      rate: 610,
      source: "live",
      fetchedAt: new Date().toISOString()
    }

    const deps = mockDeps({
      getProviderCosts: async () => [
        { provider: "reloadly", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 980, providerCostUsd: 1.58, fetchedAt: new Date().toISOString() }
      ],
      getFxRate: async () => fxSnapshot
    })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      { ...defaultOverrides, fxSpreadCaptureBps: 50 }
    )

    // Live XOF cost: 1.58 × 610 = 963.80
    // FX profit: 980 - 963.80 = 16.20
    expect(result.fxProfit).toBeCloseTo(16.2, 1)
    expect(result.fxAdjustedCost).toBeCloseTo(963.80, 1)
    expect(result.fxSnapshot?.rate).toBe(610)
  })

  it("falls back to static BPS when no FX data is available", async () => {
    const deps = mockDeps() // no getFxRate
    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      { ...defaultOverrides, fxSpreadCaptureBps: 50 }
    )

    // Static capture: 950 × (1 - 50/10000) = 950 × 0.995 = 945.25
    expect(result.fxAdjustedCost).toBeCloseTo(945.25, 1)
    expect(result.fxProfit).toBeCloseTo(4.75, 1)
    expect(result.fxSnapshot).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Layer 3 — Corridor-Aware FX Optimization
// ---------------------------------------------------------------------------

describe("Profit Engine — Layer 3: Corridor-Aware FX", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("reduces effective cost for EUR→XOF corridor (pegged, tight spread)", async () => {
    const deps = mockDeps()

    // EUR→XOF is 8 bps spread, USD→XOF is 30 bps → bonus = 22 bps
    const withEur = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF", paymentCurrency: "EUR" },
      deps,
      { ...defaultOverrides, fxSpreadCaptureBps: 50 }
    )

    const withUsd = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF", paymentCurrency: "USD" },
      deps,
      { ...defaultOverrides, fxSpreadCaptureBps: 50 }
    )

    // EUR corridor should deliver cheaper effective cost
    expect(withEur.providerCost).toBeLessThanOrEqual(withUsd.providerCost)
    // And therefore a better customer price
    expect(withEur.customerPrice).toBeLessThanOrEqual(withUsd.customerPrice)
  })
})

// ---------------------------------------------------------------------------
// Layer 4 — Intelligent Competitor Undercut (Smart Gap Fill)
// ---------------------------------------------------------------------------

describe("Profit Engine — Layer 4: Smart Gap Fill", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("undercuts competitors when benchmark is available", async () => {
    const competitor: CompetitorPrice = {
      competitor: "WorldRemit",
      productType: "airtime",
      amount: 1000,
      currency: "XOF",
      price: 1200,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString()
    }

    const deps = mockDeps({ getCompetitorPrices: async () => [competitor] })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      defaultOverrides
    )

    expect(result.customerPrice).toBeLessThan(1200)
    expect(result.undercutAmount).toBeGreaterThan(0)
    expect(result.competitorBenchmark).toBe(1200)
  })

  it("fills the gap intelligently when competitor is far above floor", async () => {
    // Competitor at 1500, our floor ~980–1000 → huge gap
    // With elasticity=0.6, we should capture ~60% of the gap as margin
    const competitor: CompetitorPrice = {
      competitor: "ExpensiveRemit",
      productType: "airtime",
      amount: 1000,
      currency: "XOF",
      price: 1500,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString()
    }

    const deps = mockDeps({ getCompetitorPrices: async () => [competitor] })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      { ...defaultOverrides, gapFillElasticity: 0.6 }
    )

    expect(result.strategy).toBe("smart_gap_fill")
    expect(result.customerPrice).toBeLessThan(1500) // still cheaper than competitor
    expect(result.customerPrice).toBeGreaterThan(1000) // captured some of the gap
    // The margin should be significantly above minimum (>3%)
    expect(result.grossMarginPercent).toBeGreaterThan(5)
  })

  it("with elasticity=0 passes all savings to customer", async () => {
    const competitor: CompetitorPrice = {
      competitor: "ExpensiveRemit",
      productType: "airtime",
      amount: 1000,
      currency: "XOF",
      price: 1500,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString()
    }

    const deps = mockDeps({ getCompetitorPrices: async () => [competitor] })

    const resultLow = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      { ...defaultOverrides, gapFillElasticity: 0 }
    )

    // With 0 elasticity, price should be close to floor
    expect(resultLow.strategy).toBe("competitor_undercut")
    // Net margin after fees and operating costs should stay near the configured floor.
    expect(resultLow.netMarginAfterCostsPercent).toBeGreaterThanOrEqual(2.9)
    expect(resultLow.netMarginAfterCostsPercent).toBeLessThan(3.5)
  })

  it("never goes below minimum margin even when undercutting", async () => {
    const competitor: CompetitorPrice = {
      competitor: "Cheap Competitor",
      productType: "airtime",
      amount: 1000,
      currency: "XOF",
      price: 960,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString()
    }

    const deps = mockDeps({ getCompetitorPrices: async () => [competitor] })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      defaultOverrides
    )

    expect(result.grossMarginPercent).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Layer 5 — Demand-Aware Margin Expansion
// ---------------------------------------------------------------------------

describe("Profit Engine — Layer 5: Demand-Aware Margin", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("applies demand surge multiplier during weekend evenings", async () => {
    const fridayEvening = new Date("2025-01-17T20:00:00Z")
    const deps = mockDeps({ now: () => fridayEvening })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      defaultOverrides
    )

    const midWeek = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps(),
      defaultOverrides
    )

    expect(result.customerPrice).toBeGreaterThanOrEqual(midWeek.customerPrice)
  })

  it("applies month-end salary surge on the 26th", async () => {
    const monthEnd = new Date("2025-01-26T12:00:00Z")  // Sunday the 26th
    const deps = mockDeps({ now: () => monthEnd })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      deps,
      defaultOverrides
    )

    const midMonth = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps({ now: () => new Date("2025-01-15T12:00:00Z") }),
      defaultOverrides
    )

    expect(result.customerPrice).toBeGreaterThanOrEqual(midMonth.customerPrice)
  })
})

// ---------------------------------------------------------------------------
// Layer 6 — Volume Velocity Rebate Intelligence
// ---------------------------------------------------------------------------

describe("Profit Engine — Layer 6: Volume Velocity Rebate", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("tracks volume for rebate negotiation", () => {
    recordProviderVolume("reloadly", 1000, "XOF")
    recordProviderVolume("reloadly", 2000, "XOF")
    recordProviderVolume("ding", 500, "XOF")

    const summary = getProviderVolumeSummary("reloadly")
    expect(summary.transactionCount).toBe(2)
    expect(summary.totalVolume).toBe(3000)
  })

  it("reduces margin floor when volume tier qualifies", async () => {
    // Record enough volume to qualify for "starter" tier (100 txns)
    for (let i = 0; i < 110; i++) {
      recordProviderVolume("reloadly", 1000, "XOF")
    }

    const withVolume = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps(),
      defaultOverrides
    )

    resetVolumeLog()

    const withoutVolume = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps(),
      defaultOverrides
    )

    // Volume rebate should make the price lower (or equal if floor is hit)
    expect(withVolume.customerPrice).toBeLessThanOrEqual(withoutVolume.customerPrice)
  })
})

// ---------------------------------------------------------------------------
// Layer 7 — Payment Fee Absorption
// ---------------------------------------------------------------------------

describe("Profit Engine — Layer 7: Payment Fee Absorption", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("grosses up customer price so net profit covers Stripe fees", async () => {
    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps(),
      { ...defaultOverrides, paymentFeePercent: 2.9, paymentFeeFixed: 0, minMarginPercent: 3 }
    )

    const stripeFee = result.customerPrice * 0.029
    const afterStripeCut = result.customerPrice - stripeFee
    const netMarginAfterFees = afterStripeCut - result.providerCost
    const netMarginPercent = (netMarginAfterFees / result.providerCost) * 100

    expect(netMarginPercent).toBeGreaterThanOrEqual(3)
    expect(netMarginAfterFees).toBeGreaterThan(0)
  })

  it("covers Stripe fees even on tight competitor undercut", async () => {
    const competitor: CompetitorPrice = {
      competitor: "TightPricer",
      productType: "airtime",
      amount: 1000,
      currency: "XOF",
      price: 960,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString()
    }

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps({ getCompetitorPrices: async () => [competitor] }),
      { ...defaultOverrides, paymentFeePercent: 2.9, paymentFeeFixed: 0, minMarginPercent: 3 }
    )

    const stripeFee = result.customerPrice * 0.029
    const netAfterFees = result.customerPrice - stripeFee - result.providerCost

    expect(netAfterFees).toBeGreaterThan(0)
  })

  it("returns netMarginAfterFees and netMarginAfterFeesPercent", async () => {
    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps(),
      { ...defaultOverrides, paymentFeePercent: 2.9, paymentFeeFixed: 0 }
    )

    expect(result.netMarginAfterFees).toBeDefined()
    expect(result.netMarginAfterFeesPercent).toBeDefined()
    expect(result.netMarginAfterFees).toBeGreaterThan(0)
    expect(result.netMarginAfterFeesPercent).toBeLessThan(result.grossMarginPercent)
  })
})

// ---------------------------------------------------------------------------
// Promotional Pricing
// ---------------------------------------------------------------------------

describe("Profit Engine — Promotional Pricing", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("applies promotional pricing when configured", async () => {
    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF" },
      mockDeps(),
      { ...defaultOverrides, promoMarginPercent: 1 }
    )

    expect(result.strategy).toBe("promotional")
    expect(result.grossMarginPercent).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Signals & Auditability
// ---------------------------------------------------------------------------

describe("Profit Engine — Signals & Auditability", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("returns pricing signals for every decision layer", async () => {
    const competitor: CompetitorPrice = {
      competitor: "WorldRemit",
      productType: "airtime",
      amount: 1000,
      currency: "XOF",
      price: 1300,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString()
    }

    const fxSnapshot: FxRateSnapshot = {
      pair: "USD_XOF",
      rate: 610,
      source: "live",
      fetchedAt: new Date().toISOString()
    }

    const deps = mockDeps({
      getCompetitorPrices: async () => [competitor],
      getProviderCosts: async () => [
        { provider: "reloadly", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 980, providerCostUsd: 1.58, fetchedAt: new Date().toISOString() }
      ],
      getFxRate: async () => fxSnapshot,
      now: () => new Date("2025-01-17T20:00:00Z") // Friday evening (demand surge)
    })

    const result = await computeOptimalPrice(
      { productId: "airtime-1000", productType: "airtime", amount: 1000, currency: "XOF", paymentCurrency: "EUR" },
      deps,
      defaultOverrides
    )

    const signalNames = result.signals.map((s) => s.name)
    expect(signalNames).toContain("provider_selected")
    expect(signalNames).toContain("fx_profit_capture")
    expect(signalNames).toContain("corridor_optimization")
    expect(signalNames).toContain("demand_surge")
    expect(signalNames).toContain("final_margin")
  })
})

// ---------------------------------------------------------------------------
// AI Margin Optimization
// ---------------------------------------------------------------------------

describe("Profit Engine — AI Margin Optimization", () => {
  beforeEach(() => {
    resetCompetitorCache()
    resetVolumeLog()
  })

  it("uses lower payment fees for wallet balance than for cards", async () => {
    const withCard = await computeOptimalPrice(
      {
        productId: "airtime-1000",
        productType: "airtime",
        amount: 1000,
        currency: "XOF",
        paymentMethod: "card"
      },
      mockDeps(),
      defaultOverrides
    )

    const withWallet = await computeOptimalPrice(
      {
        productId: "airtime-1000",
        productType: "airtime",
        amount: 1000,
        currency: "XOF",
        paymentMethod: "wallet_balance"
      },
      mockDeps(),
      defaultOverrides
    )

    expect(withWallet.customerPrice).toBeLessThan(withCard.customerPrice)
    expect(withWallet.aiOptimization?.paymentFeePercent).toBeLessThan(withCard.aiOptimization?.paymentFeePercent ?? 999)
  })

  it("supports higher margin posture for north american corridors than regional african pricing", async () => {
    const northAmerica = await computeOptimalPrice(
      {
        productId: "airtime-1000",
        productType: "airtime",
        amount: 1000,
        currency: "XOF",
        paymentMethod: "card",
        userCountryCode: "US"
      },
      mockDeps(),
      defaultOverrides
    )

    const regionalAfrica = await computeOptimalPrice(
      {
        productId: "airtime-1000",
        productType: "airtime",
        amount: 1000,
        currency: "XOF",
        paymentMethod: "mobile_money",
        userCountryCode: "CI"
      },
      mockDeps(),
      defaultOverrides
    )

    expect(northAmerica.customerPrice).toBeGreaterThanOrEqual(regionalAfrica.customerPrice)
    expect(northAmerica.aiOptimization?.locationCluster).toBe("north_america")
    expect(regionalAfrica.aiOptimization?.locationCluster).toBe("africa_regional")
  })

  it("returns optimization metadata and AI signal when contextual inputs are present", async () => {
    const result = await computeOptimalPrice(
      {
        productId: "airtime-1000",
        productType: "airtime",
        amount: 1000,
        currency: "XOF",
        paymentCurrency: "EUR",
        paymentMethod: "bank_transfer",
        userCountryCode: "FR"
      },
      mockDeps(),
      defaultOverrides
    )

    expect(result.aiOptimization).toMatchObject({
      mode: "contextual_margin",
      paymentMethod: "bank_transfer",
      userCountryCode: "FR",
      locationCluster: "core_eu"
    })
    expect(result.signals.some((signal) => signal.name === "ai_margin_optimizer")).toBe(true)
    expect(result.signals.some((signal) => signal.name === "payment_method_fee_model")).toBe(true)
  })
})
