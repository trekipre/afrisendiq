import { describe, expect, it } from "vitest"

import {
  mapJitOrderToRow,
  mapRowToJitOrder,
  mapSettlementToRow
} from "@/app/lib/supabaseOrders"
import type { JitOrder, SettlementRecord } from "@/app/lib/jitPurchaseEngine"
import type { PricingDecision } from "@/app/lib/profitEngine"

const pricingDecision: PricingDecision = {
  provider: "reloadly",
  providerCost: 950,
  customerPrice: 1040,
  fxAdjustedCost: 950,
  fxProfit: 90,
  grossMargin: 90,
  grossMarginPercent: 8.653846153846153,
  netMarginAfterFees: 78,
  netMarginAfterFeesPercent: 7.4,
  netMarginAfterCosts: 70,
  netMarginAfterCostsPercent: 6.730769230769231,
  operatingCost: 8,
  strategy: "smart_gap_fill",
  aiOptimization: {
    mode: "contextual_margin",
    score: 0.72,
    paymentMethod: "wallet_balance",
    paymentMethodLabel: "Wallet balance",
    paymentFeePercent: 0.35,
    paymentFeeFixed: 0,
    userCountryCode: "US",
    locationCluster: "north_america_learned",
    locationProfileSource: "learned",
    locationProfileSampleSize: 12,
    locationAdjustmentPercent: 0.9,
    paymentMethodAdjustmentPercent: 1.1,
    competitorPressureMultiplier: 0.91,
    demandMultiplierBoost: 1.01
  },
  signals: []
}

describe("supabaseOrders pricing mappers", () => {
  it("maps JIT orders to first-class pricing columns", () => {
    const order: JitOrder = {
      id: "jit-1",
      traceId: "trace-1",
      productId: "airtime-1000",
      productType: "airtime",
      customerReference: "+22500000001",
      recipientLabel: "Maman",
      amount: 1000,
      currency: "XOF",
      status: "settled",
      quotedPrice: 1040,
      providerCost: 950,
      afrisendiqMargin: 70,
      grossMargin: 90,
      operatingCost: 8,
      netMarginAfterFees: 78,
      paymentMethod: "wallet_balance",
      userCountryCode: "US",
      selectedProvider: "reloadly",
      pricingStrategy: "smart_gap_fill",
      pricingDecision,
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:05:00.000Z",
      transitions: []
    }

    const row = mapJitOrderToRow(order)

    expect(row.pricing_input_amount).toBe(1000)
    expect(row.pricing_provider_cost).toBe(950)
    expect(row.pricing_customer_price).toBe(1040)
    expect(row.pricing_margin).toBe(70)
    expect(row.pricing_margin_percent).toBe(pricingDecision.netMarginAfterCostsPercent)
    expect(row.pricing_gross_margin).toBe(90)
    expect(row.pricing_gross_margin_percent).toBe(pricingDecision.grossMarginPercent)
    expect(row.pricing_operating_cost).toBe(8)
    expect(row.pricing_net_margin_after_fees).toBe(78)
    expect(row.pricing_payment_method).toBe("wallet_balance")
    expect(row.pricing_user_country_code).toBe("US")
    expect(row.ai_location_cluster).toBe("north_america_learned")
    expect(row.ai_profile_source).toBe("learned")
  })

  it("maps JIT rows back while preferring first-class pricing columns", () => {
    const order = mapRowToJitOrder({
      id: "jit-2",
      trace_id: "trace-2",
      product_id: "airtime-1000",
      product_type: "airtime",
      customer_reference: "+22500000002",
      recipient_label: "Papa",
      amount: 999,
      currency: "XOF",
      status: "quoted",
      quoted_price: 1035,
      provider_cost: 945,
      margin: 66,
      pricing_input_amount: 1000,
      pricing_provider_cost: 950,
      pricing_customer_price: 1040,
      pricing_margin: 70,
      pricing_margin_percent: 6.73,
      pricing_gross_margin: 90,
      pricing_gross_margin_percent: 8.65,
      pricing_operating_cost: 8,
      pricing_net_margin_after_fees: 78,
      pricing_payment_method: "wallet_balance",
      pricing_user_country_code: "US",
      ai_location_cluster: "north_america_learned",
      ai_profile_source: "learned",
      selected_provider: "reloadly",
      pricing_strategy: "smart_gap_fill",
      payment_intent_id: null,
      provider_reference: null,
      failure_reason: null,
      pricing_decision: pricingDecision,
      guard_result: null,
      created_at: "2026-03-25T00:00:00.000Z",
      updated_at: "2026-03-25T00:05:00.000Z"
    })

    expect(order.amount).toBe(1000)
    expect(order.quotedPrice).toBe(1040)
    expect(order.providerCost).toBe(950)
    expect(order.afrisendiqMargin).toBe(70)
    expect(order.grossMargin).toBe(90)
    expect(order.operatingCost).toBe(8)
    expect(order.netMarginAfterFees).toBe(78)
    expect(order.paymentMethod).toBe("wallet_balance")
    expect(order.userCountryCode).toBe("US")
  })

  it("maps settlements to first-class pricing columns", () => {
    const settlement: SettlementRecord = {
      orderId: "jit-3",
      traceId: "trace-3",
      inputAmount: 1000,
      customerPaid: 1040,
      providerCost: 950,
      afrisendiqMargin: 70,
      marginPercent: 6.73,
      grossMargin: 90,
      grossMarginPercent: 8.65,
      operatingCost: 8,
      netMarginAfterFees: 78,
      currency: "XOF",
      paymentMethod: "wallet_balance",
      userCountryCode: "US",
      provider: "reloadly",
      pricingStrategy: "smart_gap_fill",
      pricingDecision,
      settledAt: "2026-03-25T00:10:00.000Z"
    }

    const row = mapSettlementToRow(settlement)

    expect(row.pricing_input_amount).toBe(1000)
    expect(row.pricing_provider_cost).toBe(950)
    expect(row.pricing_customer_price).toBe(1040)
    expect(row.pricing_margin).toBe(70)
    expect(row.pricing_margin_percent).toBe(6.73)
    expect(row.pricing_gross_margin).toBe(90)
    expect(row.pricing_gross_margin_percent).toBe(8.65)
    expect(row.pricing_operating_cost).toBe(8)
    expect(row.pricing_net_margin_after_fees).toBe(78)
    expect(row.pricing_decision).toEqual(pricingDecision)
    expect(row.pricing_payment_method).toBe("wallet_balance")
    expect(row.pricing_user_country_code).toBe("US")
    expect(row.ai_location_cluster).toBe("north_america_learned")
    expect(row.ai_profile_source).toBe("learned")
  })
})