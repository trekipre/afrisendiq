import { computeOptimalPrice, type PaymentMethod, type PricingDecision } from "@/app/lib/profitEngine"
import { getLearnedProfitEngineConfigOverride, resetLearnedLocationProfileCache } from "@/app/lib/profitEngineLearning"
import { getSupabase } from "@/app/lib/supabase"
import { persistJitOrder, persistSettlement } from "@/app/lib/supabaseOrders"
import type { JitOrder, SettlementRecord } from "@/app/lib/jitPurchaseEngine"

type SeedScenario = {
  label: string
  paymentMethod: PaymentMethod
  userCountryCode: "US" | "FR" | "CI"
  paymentCurrency: "USD" | "EUR" | "XOF"
  amount: number
  providerBaseCost: number
}

const SEED_ORDER_PREFIX = "AI-SEED"

const SCENARIOS: SeedScenario[] = [
  {
    label: "north-america-wallet",
    paymentMethod: "wallet_balance",
    userCountryCode: "US",
    paymentCurrency: "USD",
    amount: 15000,
    providerBaseCost: 13200
  },
  {
    label: "core-eu-bank",
    paymentMethod: "bank_transfer",
    userCountryCode: "FR",
    paymentCurrency: "EUR",
    amount: 12000,
    providerBaseCost: 10650
  },
  {
    label: "regional-africa-card",
    paymentMethod: "card",
    userCountryCode: "CI",
    paymentCurrency: "XOF",
    amount: 10000,
    providerBaseCost: 9200
  },
  {
    label: "north-america-card",
    paymentMethod: "card",
    userCountryCode: "US",
    paymentCurrency: "USD",
    amount: 18000,
    providerBaseCost: 15700
  },
  {
    label: "core-eu-wallet",
    paymentMethod: "wallet_balance",
    userCountryCode: "FR",
    paymentCurrency: "EUR",
    amount: 14000,
    providerBaseCost: 12350
  },
  {
    label: "regional-africa-bank",
    paymentMethod: "bank_transfer",
    userCountryCode: "CI",
    paymentCurrency: "XOF",
    amount: 9000,
    providerBaseCost: 8125
  },
  {
    label: "north-america-bank",
    paymentMethod: "bank_transfer",
    userCountryCode: "US",
    paymentCurrency: "USD",
    amount: 13000,
    providerBaseCost: 11400
  },
  {
    label: "core-eu-card",
    paymentMethod: "card",
    userCountryCode: "FR",
    paymentCurrency: "EUR",
    amount: 11000,
    providerBaseCost: 9750
  },
  {
    label: "regional-africa-wallet",
    paymentMethod: "wallet_balance",
    userCountryCode: "CI",
    paymentCurrency: "XOF",
    amount: 8000,
    providerBaseCost: 7150
  }
]

function buildProviderCosts(productId: string, scenario: SeedScenario) {
  const base = scenario.providerBaseCost

  return [
    {
      provider: "reloadly",
      productId,
      amount: scenario.amount,
      currency: "XOF",
      providerCost: base,
      providerCostUsd: Math.round((base / 610) * 100) / 100,
      fetchedAt: new Date().toISOString()
    },
    {
      provider: "ding",
      productId,
      amount: scenario.amount,
      currency: "XOF",
      providerCost: base + 220,
      providerCostUsd: Math.round(((base + 220) / 610) * 100) / 100,
      fetchedAt: new Date().toISOString()
    },
    {
      provider: "dtone",
      productId,
      amount: scenario.amount,
      currency: "XOF",
      providerCost: base + 340,
      providerCostUsd: Math.round(((base + 340) / 610) * 100) / 100,
      fetchedAt: new Date().toISOString()
    }
  ]
}

async function createPricingDecision(scenario: SeedScenario) {
  const productId = `seed-${scenario.label}`

  return computeOptimalPrice(
    {
      productId,
      productType: "airtime",
      amount: scenario.amount,
      currency: "XOF",
      customerReference: `seed-${scenario.userCountryCode.toLowerCase()}-${scenario.paymentMethod}`,
      paymentCurrency: scenario.paymentCurrency,
      paymentMethod: scenario.paymentMethod,
      userCountryCode: scenario.userCountryCode
    },
    {
      getCompetitorPrices: async () => [],
      getProviderCosts: async () => buildProviderCosts(productId, scenario),
      getFxRate: async () => ({
        pair: "USD_XOF",
        rate: 610,
        source: "fallback",
        fetchedAt: new Date().toISOString()
      })
    },
    await getLearnedProfitEngineConfigOverride({
      fxSpreadCaptureBps: 0
    })
  )
}

function createSeedOrder(
  seedGroup: string,
  scenario: SeedScenario,
  pricingDecision: PricingDecision,
  index: number
): JitOrder {
  const createdAt = new Date(Date.now() - (SCENARIOS.length - index) * 60_000).toISOString()
  const orderId = `${SEED_ORDER_PREFIX}-${seedGroup}-${String(index + 1).padStart(2, "0")}`
  const traceId = `${orderId}-trace`

  return {
    id: orderId,
    traceId,
    productId: `seed-${scenario.label}`,
    productType: "airtime",
    customerReference: `+225070000${String(index + 10).padStart(2, "0")}`,
    recipientLabel: `Seed ${scenario.userCountryCode} ${scenario.paymentMethod}`,
    amount: scenario.amount,
    currency: "XOF",
    status: "settled",
    quotedPrice: pricingDecision.customerPrice,
    providerCost: pricingDecision.providerCost,
    afrisendiqMargin: pricingDecision.netMarginAfterCosts,
    grossMargin: pricingDecision.grossMargin,
    operatingCost: pricingDecision.operatingCost,
    netMarginAfterFees: pricingDecision.netMarginAfterFees,
    paymentMethod: scenario.paymentMethod,
    userCountryCode: scenario.userCountryCode,
    selectedProvider: pricingDecision.provider,
    pricingStrategy: pricingDecision.strategy,
    paymentIntentId: `${orderId}-pi`,
    providerReference: `${orderId}-provider`,
    pricingDecision,
    createdAt,
    updatedAt: createdAt,
    transitions: [
      { from: null, to: "received", changedAt: createdAt, note: "AI profitability seed created" },
      { from: "received", to: "quoted", changedAt: createdAt, note: "Quoted by profit engine" },
      { from: "quoted", to: "guards_passed", changedAt: createdAt, note: "Seed bypassed guards" },
      { from: "guards_passed", to: "payment_pending", changedAt: createdAt, note: "Seed payment pending" },
      { from: "payment_pending", to: "payment_confirmed", changedAt: createdAt, note: "Seed payment confirmed" },
      { from: "payment_confirmed", to: "executing", changedAt: createdAt, note: "Seed execution started" },
      { from: "executing", to: "settled", changedAt: createdAt, note: "Seed settled" }
    ]
  }
}

function createSeedSettlement(order: JitOrder): SettlementRecord {
  return {
    orderId: order.id,
    traceId: order.traceId,
    inputAmount: order.amount,
    customerPaid: order.quotedPrice!,
    providerCost: order.providerCost!,
    afrisendiqMargin: order.afrisendiqMargin!,
    marginPercent: order.pricingDecision?.netMarginAfterCostsPercent,
    grossMargin: order.grossMargin ?? order.pricingDecision?.grossMargin ?? order.afrisendiqMargin!,
    grossMarginPercent: order.pricingDecision?.grossMarginPercent,
    operatingCost: order.operatingCost ?? order.pricingDecision?.operatingCost ?? 0,
    netMarginAfterFees: order.netMarginAfterFees ?? order.pricingDecision?.netMarginAfterFees ?? order.afrisendiqMargin!,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    userCountryCode: order.userCountryCode,
    provider: order.selectedProvider!,
    pricingStrategy: order.pricingStrategy || "arbitrage_margin",
    pricingDecision: order.pricingDecision,
    settledAt: order.updatedAt
  }
}

async function clearExistingSeedData() {
  const supabase = getSupabase()

  const settlementsDelete = await supabase
    .from("settlements")
    .delete()
    .like("order_id", `${SEED_ORDER_PREFIX}-%`)

  if (settlementsDelete.error) {
    throw new Error(`Unable to clear seeded settlements: ${settlementsDelete.error.message}`)
  }

  const jitDelete = await supabase
    .from("jit_orders")
    .delete()
    .like("id", `${SEED_ORDER_PREFIX}-%`)

  if (jitDelete.error) {
    throw new Error(`Unable to clear seeded JIT orders: ${jitDelete.error.message}`)
  }
}

async function persistSeedBatch(seedGroup: string, scenarios: SeedScenario[]) {
  const seededOrders: JitOrder[] = []

  for (const [index, scenario] of scenarios.entries()) {
    const pricingDecision = await createPricingDecision(scenario)
    const order = createSeedOrder(seedGroup, scenario, pricingDecision, index)
    const settlement = createSeedSettlement(order)

    const persistedOrder = await persistJitOrder(order)
    if (!persistedOrder) {
      throw new Error(`Failed to persist seeded order ${order.id}`)
    }

    const persistedSettlement = await persistSettlement(settlement)
    if (!persistedSettlement) {
      throw new Error(`Failed to persist seeded settlement ${order.id}`)
    }

    seededOrders.push(order)
  }

  return seededOrders
}

export async function POST() {
  await clearExistingSeedData()
  resetLearnedLocationProfileCache()

  const staticOrders = await persistSeedBatch("STATIC", SCENARIOS)

  resetLearnedLocationProfileCache()

  const learnedOrders = await persistSeedBatch("LEARNED", SCENARIOS)

  const allOrders = [...staticOrders, ...learnedOrders]

  return Response.json({
    success: true,
    summary: {
      totalOrders: allOrders.length,
      staticOrders: staticOrders.length,
      learnedOrders: learnedOrders.filter((order) => order.pricingDecision?.aiOptimization?.locationProfileSource === "learned").length,
      paymentMethods: [...new Set(allOrders.map((order) => order.paymentMethod))],
      originCountries: [...new Set(allOrders.map((order) => order.userCountryCode))],
      clusters: [...new Set(allOrders.map((order) => order.pricingDecision?.aiOptimization?.locationCluster))].filter(Boolean)
    },
    rows: allOrders.map((order) => ({
      orderId: order.id,
      paymentMethod: order.paymentMethod,
      userCountryCode: order.userCountryCode,
      customerPrice: order.quotedPrice,
      providerCost: order.providerCost,
      netMargin: order.afrisendiqMargin,
      cluster: order.pricingDecision?.aiOptimization?.locationCluster,
      profileSource: order.pricingDecision?.aiOptimization?.locationProfileSource,
      strategy: order.pricingStrategy
    }))
  })
}