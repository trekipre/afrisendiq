import { describe, expect, it } from "vitest"

import { buildLearnedLocationProfiles } from "@/app/lib/profitEngineLearning"
import type { ProfitabilityReportingRow } from "@/app/lib/supabaseOrders"

function createRow(overrides: Partial<ProfitabilityReportingRow>): ProfitabilityReportingRow {
  return {
    flowType: "jit",
    orderId: `order-${Math.random()}`,
    traceId: "trace-1",
    serviceCategory: "airtime",
    serviceReference: "airtime-1000",
    customerReference: "+22500000001",
    recipientLabel: "Recipient",
    status: "settled",
    currency: "XOF",
    inputAmount: 1000,
    providerCost: 940,
    customerPrice: 1080,
    netMargin: 90,
    netMarginPercent: 8,
    grossMargin: 120,
    grossMarginPercent: 10,
    operatingCost: 10,
    netMarginAfterFees: 100,
    paymentMethod: "card",
    userCountryCode: "US",
    aiLocationCluster: "north_america",
    aiProfileSource: "static",
    provider: "reloadly",
    pricingStrategy: "smart_gap_fill",
    pricingDecision: undefined,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:05:00.000Z",
    realizedAt: "2026-04-01T00:10:00.000Z",
    realized: true,
    ...overrides
  }
}

describe("profitEngineLearning", () => {
  it("builds learned country overlays when there is enough realized history", () => {
    const profiles = buildLearnedLocationProfiles([
      createRow({ orderId: "us-1", userCountryCode: "US", netMarginPercent: 9.8 }),
      createRow({ orderId: "us-2", userCountryCode: "US", netMarginPercent: 9.4 }),
      createRow({ orderId: "us-3", userCountryCode: "US", netMarginPercent: 9.1 }),
      createRow({ orderId: "ci-1", userCountryCode: "CI", netMarginPercent: 4.2, aiLocationCluster: "africa_regional" }),
      createRow({ orderId: "ci-2", userCountryCode: "CI", netMarginPercent: 4.5, aiLocationCluster: "africa_regional" }),
      createRow({ orderId: "ci-3", userCountryCode: "CI", netMarginPercent: 4.1, aiLocationCluster: "africa_regional" })
    ])

    expect(profiles.learned_us).toMatchObject({
      cluster: "north_america_learned",
      source: "learned",
      sampleSize: 3
    })
    expect(profiles.learned_us.marginAdjustmentPercent).toBeGreaterThan(profiles.north_america.marginAdjustmentPercent)
    expect(profiles.learned_ci).toMatchObject({
      cluster: "africa_regional_learned",
      source: "learned",
      sampleSize: 3
    })
  })

  it("falls back to static profiles when history is sparse", () => {
    const profiles = buildLearnedLocationProfiles([
      createRow({ orderId: "fr-1", userCountryCode: "FR", netMarginPercent: 8.4 }),
      createRow({ orderId: "fr-2", userCountryCode: "FR", netMarginPercent: 8.1 })
    ])

    expect(profiles.learned_fr).toBeUndefined()
    expect(profiles.core_eu.source).toBe("static")
  })
})