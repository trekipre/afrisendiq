import {
  createJitQuote,
  collectPayment,
  executeAfterPayment,
  processJitPurchase,
  resetJitOrders,
  getJitOrder,
  listJitOrders,
  listSettlements,
  type JitDependencies,
  type JitPaymentGateway,
  type JitProviderExecutor
} from "@/app/lib/jitPurchaseEngine"
import { resetTransactionGuards, updateLiquidity, getLiquidity, getLiquidityReservations } from "@/app/lib/transactionStateEngine"
import { resetCompetitorCache, resetVolumeLog } from "@/app/lib/profitEngine"

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function mockPaymentGateway(overrides?: Partial<JitPaymentGateway>): JitPaymentGateway {
  return {
    createPaymentIntent: async (input) => ({
      id: `pi_${input.orderId}`,
      amount: input.amount,
      currency: input.currency,
      status: "pending",
      createdAt: new Date().toISOString()
    }),
    confirmPayment: async (id) => ({
      id,
      amount: 0,
      currency: "XOF",
      status: "confirmed",
      createdAt: new Date().toISOString()
    }),
    refundPayment: async (id) => ({
      id,
      amount: 0,
      currency: "XOF",
      status: "refunded",
      createdAt: new Date().toISOString()
    }),
    ...overrides
  }
}

function mockProviderExecutor(overrides?: Partial<JitProviderExecutor>): JitProviderExecutor {
  return {
    execute: async (input) => ({
      reference: `txn_${input.reference}`,
      status: "completed",
      provider: input.provider
    }),
    ...overrides
  }
}

let refCounter = 0

function buildDeps(overrides?: Partial<JitDependencies>): JitDependencies {
  return {
    paymentGateway: mockPaymentGateway(),
    providerExecutor: mockProviderExecutor(),
    profitEngine: {
      getCompetitorPrices: async () => [],
      getProviderCosts: async () => [
        { provider: "reloadly", productId: "airtime-1000", amount: 1000, currency: "XOF", providerCost: 950, fetchedAt: new Date().toISOString() }
      ]
    },
    createReference: () => `ref-${++refCounter}`,
    createTraceId: () => `trace-${refCounter}`,
    ...overrides
  }
}

const baseInput = {
  productId: "airtime-1000",
  productType: "airtime",
  customerReference: "+22500000001",
  recipientLabel: "Maman",
  amount: 1000,
  currency: "XOF"
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JIT Purchase Engine", () => {
  beforeEach(() => {
    resetJitOrders()
    resetTransactionGuards()
    resetCompetitorCache()
    resetVolumeLog()
    refCounter = 0
  })

  describe("createJitQuote", () => {
    it("creates a quote with AI pricing and passes all guards", async () => {
      const quote = await createJitQuote(baseInput, buildDeps())

      expect(quote.orderId).toBeTruthy()
      expect(quote.traceId).toBeTruthy()
      expect(quote.guardResult.approved).toBe(true)
      expect(quote.pricingDecision.provider).toBe("reloadly")
      expect(quote.pricingDecision.grossMarginPercent).toBeGreaterThanOrEqual(3)
      expect(quote.pricingDecision.netMarginAfterCosts).toBeGreaterThan(0)

      const order = getJitOrder(quote.orderId)!
      expect(order.status).toBe("guards_passed")
      expect(order.pricingStrategy).toBeTruthy()
      expect(order.quoteExpiresAt).toBeTruthy()
    })

    it("stores payment rail context on the order for profitability analysis", async () => {
      const quote = await createJitQuote(
        {
          ...baseInput,
          paymentMethod: "wallet_balance",
          userCountryCode: "US"
        },
        buildDeps()
      )

      const order = getJitOrder(quote.orderId)!

      expect(order.paymentMethod).toBe("wallet_balance")
      expect(order.userCountryCode).toBe("US")
      expect(order.pricingDecision?.aiOptimization?.paymentMethod).toBe("wallet_balance")
      expect(order.pricingDecision?.aiOptimization?.userCountryCode).toBe("US")
    })

    it("rejects duplicate quotes via idempotency guard", async () => {
      const deps = buildDeps()

      await createJitQuote(baseInput, deps)
      const dup = await createJitQuote(baseInput, deps)

      expect(dup.guardResult.approved).toBe(false)
      const order = getJitOrder(dup.orderId)!
      expect(order.status).toBe("failed")
    })
  })

  describe("collectPayment", () => {
    it("creates a payment intent for guards_passed orders", async () => {
      const deps = buildDeps()
      const quote = await createJitQuote(baseInput, deps)

      const { order, paymentIntent } = await collectPayment(quote.orderId, deps)

      expect(order.status).toBe("payment_pending")
      expect(paymentIntent.status).toBe("pending")
      expect(order.paymentIntentId).toBe(paymentIntent.id)
    })

    it("rejects payment collection for non-guards_passed orders", async () => {
      const deps = buildDeps()
      const quote = await createJitQuote(baseInput, deps)

      // Execute it to move past guards_passed
      await collectPayment(quote.orderId, deps)

      // Try to collect again (now in payment_pending)
      await expect(collectPayment(quote.orderId, deps)).rejects.toThrow(
        "Cannot collect payment"
      )
    })
  })

  describe("executeAfterPayment", () => {
    it("executes provider purchase and settles after payment confirmation", async () => {
      const onSettlement = vi.fn()
      const sendPurchaseConfirmationSms = vi.fn(async () => ({
        delivered: true as const,
        to: "+22500000001",
        sid: "SM_JIT_CONFIRM",
        whatsappSid: "WA_JIT_CONFIRM",
        body: "AfriSendIQ purchase confirmed.",
      }))
      const deps = buildDeps({ onSettlement, sendPurchaseConfirmationSms })
      const quote = await createJitQuote(baseInput, deps)
      await collectPayment(quote.orderId, deps)

      const { order, transaction } = await executeAfterPayment(quote.orderId, deps)

      expect(order.status).toBe("settled")
      expect(order.providerReference).toBeTruthy()
      expect(transaction).toBeDefined()
      expect(onSettlement).toHaveBeenCalledOnce()

      const settlement = onSettlement.mock.calls[0][0]
      expect(settlement.afrisendiqMargin).toBeGreaterThan(0)
      expect(settlement.provider).toBe("reloadly")
      expect(settlement.netMarginAfterFees).toBeGreaterThanOrEqual(settlement.afrisendiqMargin)
      expect(sendPurchaseConfirmationSms).toHaveBeenCalledWith({
        reference: quote.orderId,
        productLabel: "airtime",
        amount: 1000,
        currency: "XOF",
        recipientPhoneCandidates: ["+22500000001", "Maman"],
      })
    })

    it("reserves and settles provider liquidity during successful execution", async () => {
      updateLiquidity("reloadly", 5000, "XOF", 500)

      const deps = buildDeps()
      const quote = await createJitQuote(baseInput, deps)
      await collectPayment(quote.orderId, deps)

      expect(getLiquidityReservations("reloadly")).toHaveLength(0)
      await executeAfterPayment(quote.orderId, deps)

      expect(getLiquidityReservations("reloadly")).toHaveLength(0)
      expect(getLiquidity("reloadly")?.balance).toBe(5000 - quote.pricingDecision.providerCost)
    })

    it("refunds if the quote expires before provider execution", async () => {
      const refundSpy = vi.fn(async () => ({
        id: "pi_ref-1",
        amount: 0,
        currency: "XOF",
        status: "refunded" as const,
        createdAt: new Date().toISOString()
      }))

      const deps = buildDeps({
        paymentGateway: mockPaymentGateway({ refundPayment: refundSpy })
      })

      const quote = await createJitQuote(baseInput, deps)
      const order = getJitOrder(quote.orderId)!
      order.quoteExpiresAt = new Date(Date.now() - 1000).toISOString()
      await collectPayment(quote.orderId, deps).catch(() => undefined)

      const refreshedOrder = getJitOrder(quote.orderId)!
      expect(refreshedOrder.status).toBe("failed")
      expect(refundSpy).not.toHaveBeenCalled()
    })

    it("refunds when execution-time liquidity is no longer available", async () => {
      updateLiquidity("reloadly", 1200, "XOF", 100)

      const refundSpy = vi.fn(async () => ({
        id: "pi_ref-1",
        amount: 0,
        currency: "XOF",
        status: "refunded" as const,
        createdAt: new Date().toISOString()
      }))

      const deps = buildDeps({
        paymentGateway: mockPaymentGateway({ refundPayment: refundSpy })
      })

      const quote = await createJitQuote(baseInput, deps)
      await collectPayment(quote.orderId, deps)
      updateLiquidity("reloadly", 1000, "XOF", 100)
      const { order } = await executeAfterPayment(quote.orderId, deps)

      expect(order.status).toBe("refunded")
      expect(refundSpy).toHaveBeenCalledOnce()
    })

    it("auto-refunds when provider execution fails", async () => {
      const refundSpy = vi.fn(async () => ({
        id: "pi_ref-1",
        amount: 0,
        currency: "XOF",
        status: "refunded" as const,
        createdAt: new Date().toISOString()
      }))

      const deps = buildDeps({
        paymentGateway: mockPaymentGateway({ refundPayment: refundSpy }),
        providerExecutor: {
          execute: async () => { throw new Error("Provider down") }
        }
      })

      const quote = await createJitQuote(baseInput, deps)
      await collectPayment(quote.orderId, deps)
      const { order } = await executeAfterPayment(quote.orderId, deps)

      expect(order.status).toBe("refunded")
      expect(refundSpy).toHaveBeenCalledOnce()
    })

    it("marks as failed when both provider AND refund fail", async () => {
      const deps = buildDeps({
        paymentGateway: mockPaymentGateway({
          refundPayment: async () => { throw new Error("Refund failed") }
        }),
        providerExecutor: {
          execute: async () => { throw new Error("Provider down") }
        }
      })

      const quote = await createJitQuote(baseInput, deps)
      await collectPayment(quote.orderId, deps)
      const { order } = await executeAfterPayment(quote.orderId, deps)

      expect(order.status).toBe("failed")
      expect(order.failureReason).toContain("manual resolution")
    })
  })

  describe("processJitPurchase (full flow)", () => {
    it("completes the entire zero-float flow in one call", async () => {
      const result = await processJitPurchase(baseInput, buildDeps())

      expect(result.status).toBe(200)
      expect(result.body.success).toBe(true)
      expect(result.body.provider).toBe("reloadly")
      expect(result.body.strategy).toBeTruthy()
      expect((result.body.afrisendiqMargin as number)).toBeGreaterThan(0)
    })

    it("returns 403 when transaction guards block", async () => {
      const deps = buildDeps({
        guardConfig: { maxTransactionAmount: 500 } // amount 1000 exceeds this
      })

      const result = await processJitPurchase(baseInput, deps)

      expect(result.status).toBe(403)
      expect(result.body.success).toBe(false)
      expect(result.body.blockedBy).toBeTruthy()
    })

    it("returns 502 with refund when provider fails", async () => {
      const deps = buildDeps({
        providerExecutor: {
          execute: async () => { throw new Error("Provider timeout") }
        }
      })

      const result = await processJitPurchase(baseInput, deps)

      expect(result.status).toBe(502)
      expect(result.body.refunded).toBe(true)
    })
  })

  describe("state tracking", () => {
    it("tracks all orders and settlements", async () => {
      await processJitPurchase(baseInput, buildDeps())

      expect(listJitOrders().length).toBe(1)
      expect(listSettlements().length).toBe(1)
      expect(listSettlements()[0].provider).toBe("reloadly")
    })

    it("records full transition history", async () => {
      const deps = buildDeps()
      const quote = await createJitQuote(baseInput, deps)
      await collectPayment(quote.orderId, deps)
      await executeAfterPayment(quote.orderId, deps)

      const order = getJitOrder(quote.orderId)!

      expect(order.transitions.length).toBeGreaterThanOrEqual(5)
      expect(order.transitions[0].to).toBe("received")
      expect(order.transitions[order.transitions.length - 1].to).toBe("settled")
    })
  })
})
