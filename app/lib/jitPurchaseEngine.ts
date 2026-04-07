/**
 * AfriSendIQ Just-In-Time Purchase Engine (v2)
 *
 * Zero-float architecture: customer pays FIRST, then AfriSendIQ executes
 * the provider purchase in real time. Integrates:
 *
 *   • AI Profit Engine  — dynamic pricing / competitor undercut / arbitrage
 *   • Transaction Guards — idempotency, liquidity, velocity, rate limits
 *   • Auto-refund        — provider failures refund automatically
 *   • Settlement ledger  — every cleared order records the profit
 *
 * Flow:
 *   quote → guards → payment_pending → payment_confirmed → executing → settled
 *                                                       ↘ refund_pending → refunded
 */

import {
  runTransactionGuards,
  reserveLiquidity,
  releaseLiquidity,
  settleLiquidity,
  type TransactionGuardConfig,
  type TransactionGuardResult
} from "@/app/lib/transactionStateEngine"

import {
  computeOptimalPrice,
  recordProviderVolume,
  type PricingDecision,
  type ProfitEngineConfig,
  type ProfitEngineDependencies
} from "@/app/lib/profitEngine"
import { getLearnedProfitEngineConfigOverride } from "@/app/lib/profitEngineLearning"
import { sendPurchaseConfirmationSms as sendPurchaseConfirmationSmsDefault } from "@/app/lib/purchaseConfirmation"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JitOrderStatus =
  | "received"
  | "quoted"
  | "guards_passed"
  | "payment_pending"
  | "payment_confirmed"
  | "executing"
  | "settled"
  | "refund_pending"
  | "refunded"
  | "failed"

export type JitOrderTransition = {
  from: JitOrderStatus | null
  to: JitOrderStatus
  changedAt: string
  note?: string
}

export type JitOrder = {
  id: string
  traceId: string
  productId: string
  productType: string
  customerReference: string
  recipientLabel: string
  customerName?: string
  amount: number
  currency: string
  status: JitOrderStatus
  quotedPrice?: number
  providerCost?: number
  afrisendiqMargin?: number
  grossMargin?: number
  operatingCost?: number
  netMarginAfterFees?: number
  paymentMethod?: "card" | "bank_transfer" | "mobile_money" | "wallet_balance" | "crypto" | "manual"
  userCountryCode?: string
  selectedProvider?: string
  pricingStrategy?: string
  paymentIntentId?: string
  providerReference?: string
  quoteExpiresAt?: string
  failureReason?: string
  guardResult?: TransactionGuardResult
  pricingDecision?: PricingDecision
  createdAt: string
  updatedAt: string
  transitions: JitOrderTransition[]
}

export type PaymentIntent = {
  id: string
  amount: number
  currency: string
  status: "pending" | "confirmed" | "refunded" | "failed"
  createdAt: string
}

export type SettlementRecord = {
  orderId: string
  traceId: string
  inputAmount: number
  customerPaid: number
  providerCost: number
  afrisendiqMargin: number
  marginPercent?: number
  grossMargin: number
  grossMarginPercent?: number
  operatingCost: number
  netMarginAfterFees: number
  currency: string
  paymentMethod?: JitOrder["paymentMethod"]
  userCountryCode?: string
  provider: string
  pricingStrategy: string
  pricingDecision?: PricingDecision
  settledAt: string
}

// ---------------------------------------------------------------------------
// Dependency contracts (injectable for testing)
// ---------------------------------------------------------------------------

export type JitPaymentGateway = {
  createPaymentIntent: (input: {
    amount: number
    currency: string
    orderId: string
    metadata?: Record<string, string>
  }) => Promise<PaymentIntent>

  confirmPayment: (paymentIntentId: string) => Promise<PaymentIntent>

  refundPayment: (paymentIntentId: string, reason: string) => Promise<PaymentIntent>
}

export type JitProviderExecutor = {
  execute: (input: {
    provider: string
    providerProductId: string
    amount: number
    customerReference: string
    recipientLabel: string
    reference: string
    traceId: string
  }) => Promise<Record<string, unknown>>
}

export type JitDependencies = {
  paymentGateway: JitPaymentGateway
  providerExecutor: JitProviderExecutor
  profitEngine: ProfitEngineDependencies
  createReference: () => string
  createTraceId: () => string
  onSettlement?: (record: SettlementRecord) => void
  guardConfig?: Partial<TransactionGuardConfig>
  profitConfig?: Partial<ProfitEngineConfig>
  sendPurchaseConfirmationSms?: typeof sendPurchaseConfirmationSmsDefault
}

// ---------------------------------------------------------------------------
// Order state machine
// ---------------------------------------------------------------------------

const allowedTransitions: Record<JitOrderStatus, JitOrderStatus[]> = {
  received: ["quoted", "failed"],
  quoted: ["guards_passed", "failed"],
  guards_passed: ["payment_pending", "failed"],
  payment_pending: ["payment_confirmed", "failed"],
  payment_confirmed: ["executing", "refund_pending", "failed"],
  executing: ["settled", "refund_pending", "failed"],
  settled: [],
  refund_pending: ["refunded", "failed"],
  refunded: [],
  failed: []
}

const orderStore = new Map<string, JitOrder>()
const settlements: SettlementRecord[] = []

const QUOTE_TTL_MS = 5 * 60 * 1000

export function resetJitOrders() {
  orderStore.clear()
  settlements.length = 0
}

export function getJitOrder(orderId: string) {
  return orderStore.get(orderId)
}

export function listJitOrders() {
  return [...orderStore.values()]
}

export function listSettlements() {
  return [...settlements]
}

function persistOrder(order: JitOrder) {
  orderStore.set(order.id, order)
  return order
}

function isQuoteExpired(order: JitOrder) {
  return Boolean(order.quoteExpiresAt && new Date(order.quoteExpiresAt).getTime() <= Date.now())
}

function transitionJitOrder(
  order: JitOrder,
  nextStatus: JitOrderStatus,
  patch: Partial<Omit<JitOrder, "id" | "traceId" | "createdAt" | "transitions">> = {},
  note?: string
): JitOrder {
  if (!allowedTransitions[order.status].includes(nextStatus)) {
    throw new Error(`Invalid JIT order transition from ${order.status} to ${nextStatus}`)
  }

  const changedAt = new Date().toISOString()
  const updated: JitOrder = {
    ...order,
    ...patch,
    status: nextStatus,
    updatedAt: changedAt,
    transitions: [
      ...order.transitions,
      { from: order.status, to: nextStatus, changedAt, note }
    ]
  }

  return persistOrder(updated)
}

// ---------------------------------------------------------------------------
// Step 1: Quote + Guards
// ---------------------------------------------------------------------------

export async function createJitQuote(
  input: {
    productId: string
    productType: string
    customerReference: string
    recipientLabel: string
    customerName?: string
    amount: number
    currency?: string
    paymentCurrency?: string
    paymentMethod?: "card" | "bank_transfer" | "mobile_money" | "wallet_balance" | "crypto" | "manual"
    userCountryCode?: string
  },
  deps: JitDependencies
): Promise<{
  orderId: string
  traceId: string
  pricingDecision: PricingDecision
  guardResult: TransactionGuardResult
  expiresAt: string
}> {
  const traceId = deps.createTraceId()
  const reference = deps.createReference()
  const currency = input.currency || "XOF"
  const quoteExpiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString()

  const learnedProfitConfig = await getLearnedProfitEngineConfigOverride(deps.profitConfig)

  let order: JitOrder = {
    id: reference,
    traceId,
    productId: input.productId,
    productType: input.productType,
    customerReference: input.customerReference,
    recipientLabel: input.recipientLabel,
    customerName: input.customerName,
    amount: input.amount,
    currency,
    paymentMethod: input.paymentMethod,
    userCountryCode: input.userCountryCode,
    status: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transitions: [{ from: null, to: "received", changedAt: new Date().toISOString(), note: "JIT order created" }]
  }

  persistOrder(order)

  // AI Profit Engine: compute optimal price via provider arbitrage + competitor undercut
  const pricingDecision = await computeOptimalPrice(
    {
      productId: input.productId,
      productType: input.productType,
      amount: input.amount,
      currency,
      customerReference: input.customerReference,
      paymentCurrency: input.paymentCurrency,
      paymentMethod: input.paymentMethod,
      userCountryCode: input.userCountryCode,
    },
    deps.profitEngine,
    {
      ...deps.profitConfig,
      ...learnedProfitConfig
    }
  )

  order = transitionJitOrder(order, "quoted", {
    quotedPrice: pricingDecision.customerPrice,
    providerCost: pricingDecision.providerCost,
    afrisendiqMargin: pricingDecision.grossMargin,
    selectedProvider: pricingDecision.provider,
    pricingStrategy: pricingDecision.strategy,
    pricingDecision
  }, `Quoted via ${pricingDecision.strategy}: ${pricingDecision.customerPrice} ${currency}`)

  // Transaction Guards: idempotency, velocity, rate limit, liquidity, limits
  const guardResult = await runTransactionGuards(
    {
      traceId,
      productId: input.productId,
      customerReference: input.customerReference,
      amount: input.amount,
      currency,
      provider: pricingDecision.provider,
      providerCost: pricingDecision.providerCost
    },
    deps.guardConfig
  )

  if (!guardResult.approved) {
    order = transitionJitOrder(order, "failed", {
      failureReason: `Blocked by ${guardResult.blockedBy}: ${guardResult.verdicts.find((v) => !v.passed)?.reason}`,
      guardResult
    }, `Transaction guard rejected: ${guardResult.blockedBy}`)

    return { orderId: order.id, traceId, pricingDecision, guardResult, expiresAt: new Date().toISOString() }
  }

  order = transitionJitOrder(order, "guards_passed", { guardResult }, "All transaction guards passed")
  order = persistOrder({
    ...order,
    quotedPrice: pricingDecision.customerPrice,
    providerCost: pricingDecision.providerCost,
    afrisendiqMargin: pricingDecision.netMarginAfterCosts,
    grossMargin: pricingDecision.grossMargin,
    operatingCost: pricingDecision.operatingCost,
    netMarginAfterFees: pricingDecision.netMarginAfterFees,
    selectedProvider: pricingDecision.provider,
    pricingStrategy: pricingDecision.strategy,
    pricingDecision,
    quoteExpiresAt
  })

  return {
    orderId: order.id,
    traceId,
    pricingDecision,
    guardResult,
    expiresAt: quoteExpiresAt
  }
}

// ---------------------------------------------------------------------------
// Step 2: Collect payment (zero float — money in before money out)
// ---------------------------------------------------------------------------

export async function collectPayment(
  orderId: string,
  deps: JitDependencies
): Promise<{ order: JitOrder; paymentIntent: PaymentIntent }> {
  const order = orderStore.get(orderId)

  if (!order) {
    throw new Error("JIT order not found")
  }

  if (order.status !== "guards_passed") {
    throw new Error(`Cannot collect payment for order in ${order.status} status`)
  }

  if (isQuoteExpired(order)) {
    const expired = transitionJitOrder(order, "failed", {
      failureReason: "Quote expired before payment collection"
    }, "Quote expired before payment intent creation")
    throw new Error(`Cannot collect payment for order in ${expired.status} status: quote expired`)
  }

  if (!order.quotedPrice || order.quotedPrice <= 0) {
    throw new Error("Order has no valid quoted price")
  }

  const paymentIntent = await deps.paymentGateway.createPaymentIntent({
    amount: order.quotedPrice,
    currency: order.currency,
    orderId: order.id,
    metadata: {
      traceId: order.traceId,
      productId: order.productId,
      provider: order.selectedProvider || "",
      strategy: order.pricingStrategy || ""
    }
  })

  const updated = transitionJitOrder(order, "payment_pending", {
    paymentIntentId: paymentIntent.id
  }, "Payment intent created — awaiting customer payment")

  return { order: updated, paymentIntent }
}

// ---------------------------------------------------------------------------
// Step 3: Execute after payment (the JIT moment — only float window)
// ---------------------------------------------------------------------------

export async function executeAfterPayment(
  orderId: string,
  deps: JitDependencies
): Promise<{ order: JitOrder; transaction?: Record<string, unknown> }> {
  let order = orderStore.get(orderId)

  if (!order) {
    throw new Error("JIT order not found")
  }

  if (order.status !== "payment_pending") {
    throw new Error(`Cannot execute for order in ${order.status} status`)
  }

  const confirmedPayment = await deps.paymentGateway.confirmPayment(order.paymentIntentId!)

  if (confirmedPayment.status !== "confirmed") {
    order = transitionJitOrder(order, "failed", {
      failureReason: "Payment confirmation failed"
    }, "Payment could not be confirmed")
    return { order }
  }

  order = transitionJitOrder(order, "payment_confirmed", {},
    "Payment confirmed — customer funds secured")

  if (isQuoteExpired(order)) {
    order = transitionJitOrder(order, "refund_pending", {
      failureReason: "Quote expired before provider execution"
    }, "Quote expired after payment confirmation — initiating refund")

    await deps.paymentGateway.refundPayment(order.paymentIntentId!, "Quote expired before execution")
    order = transitionJitOrder(order, "refunded", {}, "Customer refunded because quote expired")
    return { order }
  }

  const reservation = reserveLiquidity(order.traceId, order.selectedProvider!, order.providerCost!, order.currency)
  if (!reservation.reserved && !reservation.skipped) {
    order = transitionJitOrder(order, "refund_pending", {
      failureReason: reservation.reason || "Insufficient provider liquidity at execution time"
    }, "Provider liquidity unavailable at execution time — initiating refund")

    await deps.paymentGateway.refundPayment(order.paymentIntentId!, reservation.reason || "Provider liquidity unavailable at execution time")
    order = transitionJitOrder(order, "refunded", {}, "Customer refunded because execution liquidity was unavailable")
    return { order }
  }

  order = transitionJitOrder(order, "executing", {},
    `JIT provider purchase via ${order.selectedProvider}`)

  try {
    const transaction = await deps.providerExecutor.execute({
      provider: order.selectedProvider!,
      providerProductId: order.productId,
      amount: order.amount,
      customerReference: order.customerReference,
      recipientLabel: order.recipientLabel,
      reference: order.id,
      traceId: order.traceId
    })

    // Track provider volume for rebate negotiation leverage
    recordProviderVolume(order.selectedProvider!, order.amount, order.currency)

    const settlement: SettlementRecord = {
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
      pricingStrategy: order.pricingStrategy || "unknown",
      pricingDecision: order.pricingDecision,
      settledAt: new Date().toISOString()
    }

    settleLiquidity(order.traceId)
    settlements.push(settlement)
    deps.onSettlement?.(settlement)

    order = transitionJitOrder(order, "settled", {
      providerReference: String((transaction as Record<string, unknown>).reference || order.id)
    }, "Provider fulfilled — order settled, profit recorded")

    try {
      await (deps.sendPurchaseConfirmationSms ?? sendPurchaseConfirmationSmsDefault)({
        reference: order.id,
        productLabel: order.productType,
        amount: order.amount,
        currency: order.currency,
        recipientPhoneCandidates: [order.customerReference, order.recipientLabel],
        senderName: order.customerName,
      })
    } catch {
      // Customer confirmation is best-effort and must never block settlement.
    }

    return { order, transaction }
  } catch (error) {
    releaseLiquidity(order.traceId)
    order = transitionJitOrder(order, "refund_pending", {
      failureReason: error instanceof Error ? error.message : "Provider execution failed"
    }, "Provider failed — initiating automatic refund")

    try {
      await deps.paymentGateway.refundPayment(
        order.paymentIntentId!,
        `Provider execution failed: ${error instanceof Error ? error.message : "unknown"}`
      )
      order = transitionJitOrder(order, "refunded", {}, "Customer refunded automatically")
    } catch {
      order = transitionJitOrder(order, "failed", {
        failureReason: "Provider failed AND refund failed — requires manual resolution"
      }, "CRITICAL: Refund failed after provider failure")
    }

    return { order }
  }
}

// ---------------------------------------------------------------------------
// Full JIT flow in one call (webhook / simple integration)
// ---------------------------------------------------------------------------

export async function processJitPurchase(
  input: {
    productId: string
    productType: string
    customerReference: string
    recipientLabel: string
    customerName?: string
    amount: number
    currency?: string
  },
  deps: JitDependencies
): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const quote = await createJitQuote(input, deps)

    if (!quote.guardResult.approved) {
      return {
        status: 403,
        body: {
          success: false,
          error: `Transaction blocked: ${quote.guardResult.blockedBy}`,
          traceId: quote.traceId,
          blockedBy: quote.guardResult.blockedBy
        }
      }
    }

    const { paymentIntent } = await collectPayment(quote.orderId, deps)

    if (paymentIntent.status === "failed") {
      return {
        status: 402,
        body: { success: false, error: "Payment failed", traceId: quote.traceId }
      }
    }

    const { order } = await executeAfterPayment(quote.orderId, deps)

    if (order.status === "settled") {
      return {
        status: 200,
        body: {
          success: true,
          traceId: quote.traceId,
          reference: order.id,
          provider: order.selectedProvider,
          strategy: order.pricingStrategy,
          quotedPrice: order.quotedPrice,
          providerCost: order.providerCost,
          afrisendiqMargin: order.afrisendiqMargin,
          transaction: { reference: order.providerReference, status: "settled" }
        }
      }
    }

    if (order.status === "refunded") {
      return {
        status: 502,
        body: {
          success: false,
          error: "Provider failed — customer refunded automatically",
          traceId: quote.traceId,
          refunded: true
        }
      }
    }

    return {
      status: 500,
      body: {
        success: false,
        error: order.failureReason || "JIT purchase failed",
        traceId: quote.traceId
      }
    }
  } catch (error) {
    return {
      status: 500,
      body: {
        success: false,
        error: error instanceof Error ? error.message : "JIT purchase failed"
      }
    }
  }
}
