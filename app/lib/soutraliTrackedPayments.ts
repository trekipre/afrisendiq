import { lookupDTOneTransactionByExternalId, extractDTOneRechargeCode } from "@/app/lib/dtone"
import { sendPurchaseConfirmationSms } from "@/app/lib/purchaseConfirmation"
import { assessDtOneTransactionStatus } from "@/app/lib/dtoneTransactionStatus"
import {
  executeSoutraliProviderPurchase,
  getSoutraliProduct,
  quoteSoutraliProduct,
} from "@/app/lib/soutraliEngine"
import { stripePaymentService } from "@/app/lib/services/paymentService"
import {
  createSoutraliTrackedOrder,
  updateSoutraliTrackedOrder,
  type SoutraliTrackedCustomerStatus,
  type SoutraliTrackedOrder,
} from "@/app/lib/soutraliTrackedOrderState"
import {
  fetchSoutraliTrackedOrder,
  persistSoutraliTrackedOrder,
} from "@/app/lib/soutraliTrackedOrderSupabase"

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}

function createReference() {
  return `SOUTRALI-${Date.now()}`
}

function createTraceId() {
  return crypto.randomUUID()
}

function isFailureAssessment(phase: string) {
  return phase === "failed" || phase === "likely-stalled"
}

function isDtOneReconciliationEligible(
  order: SoutraliTrackedOrder
): order is SoutraliTrackedOrder & { providerExternalId: string } {
  if (order.category !== "electricity" || order.brand !== "CIE") {
    return false
  }

  if (!order.providerExternalId) {
    return false
  }

  return order.status === "provider_processing" || order.status === "refunded"
}

function buildDtOneFailureReason(providerStatus: string, assessment: ReturnType<typeof assessDtOneTransactionStatus>) {
  if (assessment.phase === "failed") {
    return `DT One reported ${providerStatus}. ${assessment.operatorHint}`
  }

  if (assessment.phase === "likely-stalled") {
    const ageDetail = assessment.ageMinutes === null
      ? "an unknown time"
      : `${assessment.ageMinutes} minute${assessment.ageMinutes === 1 ? "" : "s"}`

    return `DT One remained ${providerStatus} for ${ageDetail}. ${assessment.operatorHint}`
  }

  return `DT One reported ${providerStatus}. ${assessment.operatorHint}`
}

function logDtOneReconciliation(orderId: string, previousOrder: SoutraliTrackedOrder, nextOrder: SoutraliTrackedOrder) {
  if (previousOrder.providerStatus === nextOrder.providerStatus && previousOrder.status === nextOrder.status) {
    return
  }

  console.info("[dtone] Reconciled tracked order", {
    orderId,
    previousStatus: previousOrder.status,
    nextStatus: nextOrder.status,
    previousProviderStatus: previousOrder.providerStatus ?? null,
    nextProviderStatus: nextOrder.providerStatus ?? null,
    failureReason: nextOrder.failureReason ?? null,
  })
}

function resolveReturnPath(path: string | undefined, fallbackPath: string) {
  if (!path || typeof path !== "string") {
    return fallbackPath
  }

  if (!path.startsWith("/")) {
    return fallbackPath
  }

  return path
}

function resolveDefaultReturnPath(category: SoutraliTrackedOrder["category"]) {
  switch (category) {
    case "airtime":
      return "/cote-divoire/phone-top-up"
    case "data":
      return "/cote-divoire/data-top-up"
    case "gift-card":
      return "/cote-divoire/gift-cards"
    case "electricity":
      return "/cote-divoire/cie-prepaid"
    default:
      return "/cote-divoire"
  }
}

export async function createSoutraliTrackedCheckoutSession(input: {
  productId: string
  customerReference: string
  recipientLabel: string
  senderName?: string
  beneficiaryPhoneNumber?: string
  recipientEmail?: string
  amount: number
  returnPath?: string
}) {
  const product = getSoutraliProduct(input.productId)

  if (!product) {
    throw new Error("Soutrali product not found")
  }

  const quote = await quoteSoutraliProduct({
    productId: input.productId,
    amount: input.amount,
    customerReference: input.customerReference,
  })

  if (product.category === "electricity" && product.brand === "CIE" && quote.bestOffer.executionMode !== "live") {
    throw new Error("Live CIE prepaid checkout is blocked until a live provider is enabled for this amount.")
  }

  const order = createSoutraliTrackedOrder({
    id: createReference(),
    traceId: createTraceId(),
    productId: product.id,
    productName: product.name,
    category: product.category,
    brand: product.brand,
    amount: input.amount,
    quotedPrice: quote.bestOffer.customerPrice,
    currency: "XOF",
    customerReference: input.customerReference,
    recipientLabel: input.recipientLabel,
    senderName: input.senderName || undefined,
    beneficiaryPhoneNumber: input.beneficiaryPhoneNumber || undefined,
    recipientEmail: input.recipientEmail || undefined,
    paymentStatus: "pending",
    selectedProvider: quote.bestOffer.provider,
    selectedExecutionMode: quote.bestOffer.executionMode,
    returnPath: resolveReturnPath(input.returnPath, resolveDefaultReturnPath(product.category)),
  })

  await persistSoutraliTrackedOrder(order)

  const session = await stripePaymentService.createCheckoutSession({
    orderId: order.id,
    amount: order.quotedPrice,
    currency: order.currency,
    customerEmail: input.recipientEmail,
    successUrl: `${getBaseUrl()}${order.returnPath}?orderId=${encodeURIComponent(order.id)}&payment=success`,
    cancelUrl: `${getBaseUrl()}${order.returnPath}?orderId=${encodeURIComponent(order.id)}&payment=cancelled`,
    metadata: {
      orderType: "soutrali_tracked",
      service: product.category,
      brand: product.brand,
    },
  })

  const updatedOrder = updateSoutraliTrackedOrder(order, {
    status: "payment_pending",
    paymentSessionId: session.paymentId,
  })

  await persistSoutraliTrackedOrder(updatedOrder)

  return {
    orderId: updatedOrder.id,
    checkoutUrl: session.checkoutUrl,
    quotedPrice: updatedOrder.quotedPrice,
  }
}

function resolveTrackedCompletionStatus(order: SoutraliTrackedOrder, transaction: Record<string, unknown>) {
  const rechargeCode = typeof transaction.rechargeCode === "string"
    ? transaction.rechargeCode
    : extractDTOneRechargeCode(transaction)

  const providerExternalId = typeof transaction.externalId === "string"
    ? transaction.externalId
    : typeof transaction.external_id === "string"
      ? transaction.external_id
      : order.category === "electricity"
        ? order.id
        : undefined

  const providerStatus = typeof transaction.status === "string"
    ? transaction.status
    : typeof (transaction.status as { message?: unknown } | undefined)?.message === "string"
      ? String((transaction.status as { message?: string }).message)
      : "completed"

  if (rechargeCode) {
    return {
      status: "code_ready" as const,
      rechargeCode,
      providerExternalId,
      providerStatus,
    }
  }

  if (order.category === "electricity" && order.brand === "CIE") {
    return {
      status: "provider_processing" as const,
      rechargeCode: undefined,
      providerExternalId,
      providerStatus,
    }
  }

  return {
    status: "completed" as const,
    rechargeCode: undefined,
    providerExternalId,
    providerStatus,
  }
}

export async function executeSoutraliTrackedOrderAfterPayment(orderId: string) {
  const order = await fetchSoutraliTrackedOrder(orderId)

  if (!order) {
    throw new Error("Soutrali tracked order not found")
  }

  if (order.status === "completed" || order.status === "code_ready" || order.status === "refunded") {
    return order
  }

  const paymentReceivedOrder = updateSoutraliTrackedOrder(order, {
    status: "payment_received",
    paymentStatus: "paid",
  })
  await persistSoutraliTrackedOrder(paymentReceivedOrder)

  try {
    const product = getSoutraliProduct(paymentReceivedOrder.productId)

    if (!product) {
      throw new Error("Soutrali product not found for tracked order")
    }

    const transaction = await executeSoutraliProviderPurchase({
      product,
      customerReference: paymentReceivedOrder.customerReference,
      recipientLabel: paymentReceivedOrder.recipientLabel,
      beneficiaryPhoneNumber: paymentReceivedOrder.beneficiaryPhoneNumber,
      amount: paymentReceivedOrder.amount,
      reference: paymentReceivedOrder.id,
      selectedProvider: paymentReceivedOrder.selectedProvider,
      selectedExecutionMode: paymentReceivedOrder.selectedExecutionMode,
      traceId: paymentReceivedOrder.traceId,
    })

    const completion = resolveTrackedCompletionStatus(paymentReceivedOrder, transaction)
    const updatedOrder = updateSoutraliTrackedOrder(paymentReceivedOrder, completion)
    await persistSoutraliTrackedOrder(updatedOrder)

    if (updatedOrder.status === "completed" || updatedOrder.status === "code_ready") {
      try {
        await sendPurchaseConfirmationSms({
          reference: updatedOrder.id,
          productLabel: updatedOrder.productName,
          productCategory: updatedOrder.category,
          productBrand: updatedOrder.brand,
          amount: updatedOrder.amount,
          currency: updatedOrder.currency,
          recipientPhoneCandidates: [updatedOrder.beneficiaryPhoneNumber, updatedOrder.customerReference],
          senderName: updatedOrder.senderName,
          rechargeCode: updatedOrder.rechargeCode,
        })
      } catch {
        // Confirmation is best-effort and must not break tracked-order fulfillment.
      }
    }

    return updatedOrder
  } catch (error) {
    if (paymentReceivedOrder.paymentSessionId) {
      await stripePaymentService.refundPayment(paymentReceivedOrder.paymentSessionId, "Provider execution failed")
    }

    const refundedOrder = updateSoutraliTrackedOrder(paymentReceivedOrder, {
      status: "refunded",
      paymentStatus: "refunded",
      failureReason: error instanceof Error ? error.message : "Provider execution failed",
    })
    await persistSoutraliTrackedOrder(refundedOrder)
    return refundedOrder
  }
}

export async function refreshSoutraliTrackedOrder(orderId: string) {
  const order = await fetchSoutraliTrackedOrder(orderId)

  if (!order) {
    return null
  }

  if (!isDtOneReconciliationEligible(order)) {
    return order
  }

  const providerExternalId = order.providerExternalId

  try {
    const result = await lookupDTOneTransactionByExternalId(providerExternalId)
    const transaction = result.transaction as Record<string, unknown>
    const statusRecord = transaction.status as Record<string, unknown> | undefined
    const providerStatus = typeof statusRecord?.message === "string"
      ? statusRecord.message
      : String(statusRecord?.id ?? "UNKNOWN")
    const rechargeCode = result.rechargeCode ?? extractDTOneRechargeCode(transaction)

    if (rechargeCode) {
      const codeReadyOrder = updateSoutraliTrackedOrder(order, {
        status: order.paymentStatus === "refunded" ? "refunded" : "code_ready",
        providerStatus,
        rechargeCode,
        failureReason: order.paymentStatus === "refunded"
          ? "DT One returned a recharge code after the customer had already been refunded. Reconcile manually."
          : undefined,
      })
      await persistSoutraliTrackedOrder(codeReadyOrder)
      logDtOneReconciliation(orderId, order, codeReadyOrder)
      return codeReadyOrder
    }

    const assessment = assessDtOneTransactionStatus(transaction)

    if (isFailureAssessment(assessment.phase)) {
      const failureReason = buildDtOneFailureReason(providerStatus, assessment)

      if (order.paymentSessionId && order.paymentStatus !== "refunded") {
        await stripePaymentService.refundPayment(order.paymentSessionId, "Provider failed after payment")
      }

      const refundedOrder = updateSoutraliTrackedOrder(order, {
        status: "refunded",
        paymentStatus: "refunded",
        providerStatus,
        failureReason,
      })
      await persistSoutraliTrackedOrder(refundedOrder)
      logDtOneReconciliation(orderId, order, refundedOrder)
      return refundedOrder
    }

    const updatedOrder = updateSoutraliTrackedOrder(order, {
      providerStatus,
      failureReason: order.status === "refunded"
        ? `DT One later reported ${providerStatus} after the customer refund.`
        : order.failureReason,
    })
    await persistSoutraliTrackedOrder(updatedOrder)
    logDtOneReconciliation(orderId, order, updatedOrder)
    return updatedOrder
  } catch {
    return order
  }
}

export function buildCustomerFacingSoutraliStatus(order: SoutraliTrackedOrder) {
  let customerStatus: SoutraliTrackedCustomerStatus = "failed"

  if (order.status === "payment_pending") {
    customerStatus = "awaiting_payment"
  } else if (order.status === "payment_received") {
    customerStatus = "payment_received"
  } else if (order.status === "provider_processing") {
    customerStatus = "processing"
  } else if (order.status === "completed") {
    customerStatus = "completed"
  } else if (order.status === "code_ready") {
    customerStatus = "code_ready"
  } else if (order.status === "refunded") {
    customerStatus = "refunded"
  }

  return {
    customerStatus,
    reference: order.status === "payment_pending" ? null : order.id,
    rechargeCode: order.rechargeCode || null,
    showReference: order.status !== "payment_pending",
  }
}