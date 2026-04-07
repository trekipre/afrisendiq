import { amlCheck as amlCheckDefault } from "@/app/lib/aml"
import {
  createAirtimeOrder,
  transitionAirtimeOrder,
  type AirtimeOrder
} from "@/app/lib/orderState"
import { computeOptimalPrice } from "@/app/lib/profitEngine"
import { getLearnedProfitEngineConfigOverride } from "@/app/lib/profitEngineLearning"
import {
  executeAirtimeWithFallback as executeAirtimeWithFallbackDefault,
  type AirtimeProvider,
  type ProviderExecutionAttempt
} from "@/app/lib/providerExecution"
import { logTransaction as logTransactionDefault } from "@/app/lib/ledger"
import { recordExecutionTelemetry as recordExecutionTelemetryDefault } from "@/app/lib/executionTelemetry"
import { sendPurchaseConfirmationSms as sendPurchaseConfirmationSmsDefault } from "@/app/lib/purchaseConfirmation"
import { detectOperator as detectOperatorDefault } from "@/app/providers/reloadly"

type DetectOperatorResult = {
  operatorId?: number
  name?: string
}

type AirtimePurchaseBody = {
  phone?: string
  amount?: number
  senderName?: string
  paymentCurrency?: string
  paymentMethod?: "card" | "bank_transfer" | "mobile_money" | "wallet_balance" | "crypto" | "manual"
  userCountryCode?: string
}

export type AirtimePurchaseResponse = {
  status: number
  body: Record<string, unknown>
}

type AirtimePurchaseDependencies = {
  amlCheck: typeof amlCheckDefault
  createReference: () => string
  createTraceId: () => string
  detectOperator: (phone: string, countryCode: string) => Promise<DetectOperatorResult>
  executeAirtimeWithFallback: typeof executeAirtimeWithFallbackDefault
  logTransaction: typeof logTransactionDefault
  recordExecutionTelemetry: typeof recordExecutionTelemetryDefault
  sendPurchaseConfirmationSms: typeof sendPurchaseConfirmationSmsDefault
}

const defaultDependencies: AirtimePurchaseDependencies = {
  amlCheck: amlCheckDefault,
  createReference: () => `AFRISEND-${Date.now()}`,
  createTraceId: () => crypto.randomUUID(),
  detectOperator: detectOperatorDefault,
  executeAirtimeWithFallback: executeAirtimeWithFallbackDefault,
  logTransaction: logTransactionDefault,
  recordExecutionTelemetry: recordExecutionTelemetryDefault,
  sendPurchaseConfirmationSms: sendPurchaseConfirmationSmsDefault
}

function getProviderPriority() {
  return (process.env.AIRTIME_PROVIDER_PRIORITY || "reloadly")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean) as AirtimeProvider[]
}

async function quoteAirtimeAmount(
  amount: number,
  operatorId?: number,
  options: {
    paymentCurrency?: string
    paymentMethod?: AirtimePurchaseBody["paymentMethod"]
    userCountryCode?: string
  } = {}
) {
  const providerPriority = getProviderPriority()
  const learnedProfitConfig = await getLearnedProfitEngineConfigOverride({
    fxSpreadCaptureBps: 0
  })
  const pricingDecision = await computeOptimalPrice(
    {
      productId: `ci-airtime-${operatorId ?? "generic"}`,
      productType: "airtime",
      amount,
      currency: "XOF",
      paymentCurrency: options.paymentCurrency,
      paymentMethod: options.paymentMethod,
      userCountryCode: options.userCountryCode,
    },
    {
      getCompetitorPrices: async () => [],
      getProviderCosts: async (productId) => providerPriority.map((provider) => ({
        provider,
        productId,
        amount,
        currency: "XOF",
        providerCost: amount,
        fetchedAt: new Date().toISOString()
      }))
    },
    learnedProfitConfig ?? {
      fxSpreadCaptureBps: 0
    }
  )

  return pricingDecision.customerPrice
}

function transitionOrder(
  order: AirtimeOrder,
  nextStatus: Parameters<typeof transitionAirtimeOrder>[1],
  deps: AirtimePurchaseDependencies,
  patch: Parameters<typeof transitionAirtimeOrder>[2] = {},
  note?: string
) {
  const updatedOrder = transitionAirtimeOrder(order, nextStatus, patch, note)
  deps.recordExecutionTelemetry({
    traceId: updatedOrder.traceId,
    orderId: updatedOrder.id,
    type: "order.transitioned",
    metadata: {
      from: order.status,
      to: nextStatus,
      note
    }
  })

  return updatedOrder
}

export async function processAirtimePurchase(
  body: unknown,
  overrides: Partial<AirtimePurchaseDependencies> = {}
): Promise<AirtimePurchaseResponse> {
  const deps = { ...defaultDependencies, ...overrides }
  const request = typeof body === "object" && body !== null ? body as AirtimePurchaseBody : {}
  const phone = String(request.phone || "").trim()
  const amount = Number(request.amount)
  const senderName = String(request.senderName || "").trim() || undefined
  const paymentCurrency = typeof request.paymentCurrency === "string" ? request.paymentCurrency.trim().toUpperCase() || undefined : undefined
  const paymentMethod = typeof request.paymentMethod === "string" ? request.paymentMethod : undefined
  const userCountryCode = typeof request.userCountryCode === "string" ? request.userCountryCode.trim().toUpperCase() || undefined : undefined

  if (!phone) {
    return {
      status: 400,
      body: { success: false, error: "Phone is required" }
    }
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      status: 400,
      body: { success: false, error: "Amount must be a positive number" }
    }
  }

  const traceId = deps.createTraceId()
  const reference = deps.createReference()
  let order = createAirtimeOrder({
    id: reference,
    traceId,
    phone,
    amount,
    countryCode: "CI"
  })

  deps.recordExecutionTelemetry({
    traceId,
    orderId: order.id,
    type: "order.created",
    metadata: {
      phone,
      amount,
      countryCode: "CI"
    }
  })

  try {
    const operator = await deps.detectOperator(phone, "CI")

    if (!operator.operatorId) {
      order = transitionOrder(order, "failed", deps, { failureReason: "Operator not found" }, "Operator not found")
      deps.recordExecutionTelemetry({
        traceId,
        orderId: order.id,
        type: "purchase.failed",
        message: "Operator not found"
      })

      return {
        status: 400,
        body: { success: false, error: "Operator not found", traceId }
      }
    }

    order = transitionOrder(
      order,
      "operator_resolved",
      deps,
      {
        operatorId: operator.operatorId,
        operatorName: operator.name || "Unknown operator"
      },
      "Operator resolved"
    )

    const riskScore = deps.amlCheck({
      amount,
      recentTransactions: 0
    })
    const quotedPrice = await quoteAirtimeAmount(amount, operator.operatorId, {
      paymentCurrency,
      paymentMethod,
      userCountryCode,
    })

    order = transitionOrder(
      order,
      "risk_checked",
      deps,
      {
        riskScore,
        quotedPrice,
        reference
      },
      "AML completed"
    )

    order = transitionOrder(order, "executing", deps, {}, "Submitting to provider")

    const execution = await deps.executeAirtimeWithFallback(
      {
        traceId,
        phone,
        amount,
        operatorId: operator.operatorId,
        reference,
        countryCode: "CI"
      },
      {
        providerPriority: getProviderPriority(),
        onAttempt: (attempt: ProviderExecutionAttempt) => {
          deps.recordExecutionTelemetry({
            traceId,
            orderId: order.id,
            type: attempt.success ? "provider.attempt.succeeded" : "provider.attempt.failed",
            provider: attempt.provider,
            message: attempt.error,
            metadata: {
              startedAt: attempt.startedAt,
              finishedAt: attempt.finishedAt
            }
          })
        }
      }
    )

    order = transitionOrder(
      order,
      "submitted",
      deps,
      {
        provider: execution.provider,
        reference
      },
      `Submitted with ${execution.provider}`
    )

    deps.logTransaction({
      id: reference,
      traceId,
      phone,
      operator: order.operatorName || "Unknown operator",
      amount,
      status: execution.status,
      provider: execution.provider.toUpperCase(),
      riskScore: order.riskScore,
      quotedPrice: order.quotedPrice
    })

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "purchase.completed",
      provider: execution.provider,
      metadata: {
        attempts: execution.attempts.length
      }
    })

    try {
      const confirmation = await deps.sendPurchaseConfirmationSms({
        reference,
        productLabel: `${order.operatorName || "Airtime"} airtime`,
        productCategory: "airtime",
        amount,
        currency: "XOF",
        recipientPhoneCandidates: [phone],
        senderName,
      })

      deps.recordExecutionTelemetry({
        traceId,
        orderId: order.id,
        type: confirmation.delivered ? "customer.notification.sent" : "customer.notification.skipped",
        provider: execution.provider,
        message: confirmation.delivered ? undefined : confirmation.reason,
        metadata: confirmation.delivered
          ? {
              channel: confirmation.whatsappSid ? "twilio_whatsapp" : "twilio_sms",
              sid: confirmation.sid,
              whatsappSid: confirmation.whatsappSid,
              to: confirmation.to,
            }
          : {
              channel: "twilio_sms",
              reason: confirmation.reason,
            }
      })
    } catch (error) {
      deps.recordExecutionTelemetry({
        traceId,
        orderId: order.id,
        type: "customer.notification.failed",
        provider: execution.provider,
        message: error instanceof Error ? error.message : "Unable to send purchase confirmation SMS",
        metadata: {
          channel: "twilio_sms",
        }
      })
    }

    return {
      status: 200,
      body: {
        success: true,
        traceId,
        reference,
        quotedPrice,
        transaction: execution.transaction
      }
    }
  } catch (error) {
    if (order.status !== "failed") {
      order = transitionOrder(
        order,
        "failed",
        deps,
        {
          failureReason: error instanceof Error ? error.message : "Unable to process airtime purchase"
        },
        "Purchase failed"
      )
    }

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "purchase.failed",
      message: error instanceof Error ? error.message : "Unable to process airtime purchase"
    })

    return {
      status: 500,
      body: {
        success: false,
        error: error instanceof Error ? error.message : "Unable to process airtime purchase"
      }
    }
  }
}