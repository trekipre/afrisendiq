import {
  createManualBillingOrder,
  getManualBillingOrder,
  resetManualBillingOrders,
  transitionManualBillingOrder
} from "@/app/lib/manualBillingState"

describe("manual billing state", () => {
  beforeEach(() => {
    resetManualBillingOrders()
  })

  it("supports the quote -> payment -> operator -> complete lifecycle", () => {
    const created = createManualBillingOrder({
      id: "SODECI-1",
      traceId: "trace-1",
      service: "sodeci",
      countryCode: "CI",
      accountReference: "SODECI-0001",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    const quoteReady = transitionManualBillingOrder(created, "quote_ready", { quotedAmount: 12450 }, "Bill looked up")
    const paymentPending = transitionManualBillingOrder(quoteReady, "payment_pending", { paymentSessionId: "cs_test_1" }, "Stripe checkout created")
    const paid = transitionManualBillingOrder(paymentPending, "paid", { stripePaymentStatus: "paid" }, "Stripe payment confirmed")
    const started = transitionManualBillingOrder(paid, "operator_started", {}, "Operator started")
    const confirmed = transitionManualBillingOrder(started, "operator_confirmed", {}, "Operator confirmed")
    const completed = transitionManualBillingOrder(confirmed, "completed", {}, "Operator completed")

    expect(completed.status).toBe("completed")
    expect(completed.quotedAmount).toBe(12450)
    expect(completed.paymentSessionId).toBe("cs_test_1")
    expect(completed.transitions).toHaveLength(7)
    expect(getManualBillingOrder("SODECI-1")?.status).toBe("completed")
  })

  it("keeps Canal+ fixed package pricing metadata on the order", () => {
    const order = createManualBillingOrder({
      id: "CANAL-1",
      traceId: "trace-canal-1",
      service: "canal-plus",
      countryCode: "CI",
      accountReference: "CANAL-7788",
      packageCode: "evasion",
      packageLabel: "Canal+ Evasion",
      quotedAmount: 10000,
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    const quoteReady = transitionManualBillingOrder(order, "quote_ready", {}, "Package selected")

    expect(quoteReady.packageCode).toBe("evasion")
    expect(quoteReady.packageLabel).toBe("Canal+ Evasion")
    expect(quoteReady.quotedAmount).toBe(10000)
  })

  it("stores manual pricing metadata on the order", () => {
    const order = createManualBillingOrder({
      id: "SODECI-PRICE-1",
      traceId: "trace-price-1",
      service: "sodeci",
      countryCode: "CI",
      accountReference: "SODECI-0002",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      },
      pricingSummary: {
        source: "manual-billing-profit-engine",
        inputAmount: 10000,
        providerCost: 10000,
        customerPrice: 10500,
        afrisendiqMargin: 200,
        afrisendiqMarginPercent: 2,
        pricingStrategy: "arbitrage_margin",
        pricingDecision: {
          customerPrice: 10500,
          providerCost: 10000,
          fxAdjustedCost: 10000,
          fxProfit: 0,
          operatingCost: 0,
          grossMargin: 500,
          grossMarginPercent: 5,
          netMarginAfterFees: 200,
          netMarginAfterFeesPercent: 2,
          netMarginAfterCosts: 200,
          netMarginAfterCostsPercent: 2,
          provider: "manual-billing",
          strategy: "arbitrage_margin",
          signals: []
        }
      }
    })

    expect(order.pricingSummary?.customerPrice).toBe(10500)
    expect(order.pricingSummary?.providerCost).toBe(10000)
  })

  it("rejects invalid transitions", () => {
    const order = createManualBillingOrder({
      id: "CIE-1",
      traceId: "trace-cie-1",
      service: "cie-postpaid",
      countryCode: "CI",
      accountReference: "CIE-POST-1",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    expect(() => transitionManualBillingOrder(order, "paid", {}, "Skipping quote is invalid")).toThrow(
      "Invalid manual billing transition from quote_requested to paid"
    )
  })
})