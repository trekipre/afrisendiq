import type {
  ManualBillingAutomationStatus,
  ManualBillingDuplicateRisk,
  ManualBillingInsightPriority,
  ManualBillingOperationalInsights,
  ManualBillingOrder,
  ManualBillingService,
  ManualBillingStatus,
} from "@/app/lib/manualBillingState"

type ManualBillingDraftInput = {
  service: ManualBillingService
  accountReference: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  recipientName: string
}

type ManualBillingDuplicateMatch = {
  service: ManualBillingService
  accountReference: string
  customerEmail: string
  recipientName: string
}

const OPEN_ORDER_STATUSES: ManualBillingStatus[] = [
  "quote_requested",
  "quote_ready",
  "payment_pending",
  "paid",
  "operator_started",
  "operator_confirmed",
]

function normalizeComparisonText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeReferenceKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function normalizeManualBillingAccountReference(service: ManualBillingService, rawValue: string) {
  const normalized = normalizeReferenceKey(rawValue)

  if (service === "sodeci" || service === "cie-postpaid" || service === "cie-prepaid") {
    return normalized
  }

  return rawValue.trim().toUpperCase().replace(/\s+/g, " ")
}

export function normalizeManualBillingPhone(rawValue?: string) {
  if (!rawValue) {
    return undefined
  }

  const normalized = rawValue.trim().replace(/\s+/g, "")
  return normalized || undefined
}

export function validateManualBillingDraft(input: ManualBillingDraftInput) {
  const errors: string[] = []
  const normalizedAccountReference = normalizeManualBillingAccountReference(input.service, input.accountReference)
  const email = input.customerEmail.trim().toLowerCase()

  if (input.customerName.trim().length < 2) {
    errors.push("Customer name must be at least 2 characters")
  }

  if (input.recipientName.trim().length < 2) {
    errors.push("Recipient name must be at least 2 characters")
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Customer email must be valid")
  }

  if (normalizedAccountReference.length < 6) {
    errors.push("Account reference must contain at least 6 letters or digits")
  }

  if ((input.service === "sodeci" || input.service === "cie-postpaid" || input.service === "cie-prepaid") && !/[0-9]{5,}/.test(normalizedAccountReference)) {
    errors.push("CIE and SODECI references should contain at least 5 digits")
  }

  return {
    errors,
    normalizedAccountReference,
    normalizedEmail: email,
    normalizedRecipientName: input.recipientName.trim(),
    normalizedCustomerName: input.customerName.trim(),
    normalizedPhone: normalizeManualBillingPhone(input.customerPhone),
  }
}

function isRecentOrder(order: ManualBillingOrder, now = Date.now()) {
  const orderTime = new Date(order.createdAt).getTime()
  return Number.isFinite(orderTime) && now - orderTime <= 1000 * 60 * 60 * 24 * 45
}

function matchesReference(order: ManualBillingOrder, service: ManualBillingService, normalizedAccountReference: string) {
  const storedReference = normalizeManualBillingAccountReference(service, order.accountReference)
  return order.service === service && storedReference === normalizedAccountReference
}

function isOpenOrder(status: ManualBillingStatus) {
  return OPEN_ORDER_STATUSES.includes(status)
}

export function findResumableManualOrder(orders: ManualBillingOrder[], match: ManualBillingDuplicateMatch) {
  const normalizedAccountReference = normalizeManualBillingAccountReference(match.service, match.accountReference)
  const normalizedEmail = match.customerEmail.trim().toLowerCase()
  const normalizedRecipient = normalizeComparisonText(match.recipientName)

  return orders
    .filter((order) => matchesReference(order, match.service, normalizedAccountReference))
    .filter((order) => isOpenOrder(order.status))
    .filter((order) => order.customer.customerEmail.trim().toLowerCase() === normalizedEmail)
    .filter((order) => normalizeComparisonText(order.customer.recipientName) === normalizedRecipient)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
}

export function buildManualBillingOperationalInsights(order: ManualBillingOrder, universe: ManualBillingOrder[]): ManualBillingOperationalInsights {
  const normalizedAccountReference = normalizeManualBillingAccountReference(order.service, order.accountReference)

  const relatedOrders = universe.filter((candidate) => candidate.id !== order.id)
    .filter((candidate) => matchesReference(candidate, order.service, normalizedAccountReference))

  const recentOrders = relatedOrders.filter((candidate) => isRecentOrder(candidate))
  const relatedOpenOrders = recentOrders.filter((candidate) => isOpenOrder(candidate.status))
  const relatedCompletedOrders = recentOrders.filter((candidate) => candidate.status === "completed")
  const exactDuplicateOpenOrder = relatedOpenOrders.find((candidate) =>
    candidate.customer.customerEmail.trim().toLowerCase() === order.customer.customerEmail.trim().toLowerCase() &&
    normalizeComparisonText(candidate.customer.recipientName) === normalizeComparisonText(order.customer.recipientName)
  )

  const duplicateRisk: ManualBillingDuplicateRisk = exactDuplicateOpenOrder
    ? "high"
    : relatedOpenOrders.length >= 2
      ? "medium"
      : "low"

  const lastCompletedOrder = [...relatedCompletedOrders].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]

  let priority: ManualBillingInsightPriority = "low"
  if (order.status === "paid" || order.status === "operator_started" || order.status === "operator_confirmed") {
    priority = "high"
  } else if (order.status === "quote_requested" || order.status === "quote_ready" || order.status === "payment_pending" || duplicateRisk !== "low") {
    priority = "medium"
  }

  let automationStatus: ManualBillingAutomationStatus = "new_request"
  if (order.status === "quote_requested") {
    automationStatus = exactDuplicateOpenOrder ? "resume_existing" : "needs_manual_quote"
  } else if (order.status === "quote_ready" || order.status === "payment_pending") {
    automationStatus = "payment_ready"
  } else if (order.status === "paid" || order.status === "operator_started" || order.status === "operator_confirmed") {
    automationStatus = "awaiting_operator"
  } else if (order.status === "completed") {
    automationStatus = "completed"
  } else if (order.status === "failed") {
    automationStatus = "failed"
  }

  const suggestedNextAction = exactDuplicateOpenOrder
    ? `Resume existing open order ${exactDuplicateOpenOrder.id} instead of opening another request.`
    : order.status === "quote_requested"
      ? "Look up the live bill and add the bill amount before payment."
      : order.status === "quote_ready" || order.status === "payment_pending"
        ? "Push the customer to Stripe checkout and monitor payment confirmation."
        : order.status === "paid"
          ? "Operator should start execution now and confirm bill submission." 
          : order.status === "operator_started"
            ? "Confirm the utility payment once the operator has proof of submission."
            : order.status === "operator_confirmed"
              ? "Mark complete after final success evidence is verified."
              : order.status === "completed"
                ? "Use this order as reference for future repeat customers."
                : "Review failure notes before contacting the customer again."

  return {
    normalizedAccountReference,
    duplicateRisk,
    priority,
    automationStatus,
    suggestedNextAction,
    relatedOpenOrders: relatedOpenOrders.length,
    relatedCompletedOrders: relatedCompletedOrders.length,
    recentOrderCount: recentOrders.length,
    knownAccount: Boolean(lastCompletedOrder),
    resumableOrderId: exactDuplicateOpenOrder?.id,
    lastCompletedOrderId: lastCompletedOrder?.id,
    lastKnownBillAmount: lastCompletedOrder?.pricingSummary?.inputAmount,
    lastKnownQuotedAmount: lastCompletedOrder?.quotedAmount,
  }
}

export function withManualBillingOperationalInsights(order: ManualBillingOrder, universe: ManualBillingOrder[]) {
  return {
    ...order,
    metadata: {
      ...(order.metadata ?? {}),
      normalizedAccountReference: normalizeManualBillingAccountReference(order.service, order.accountReference),
      insights: buildManualBillingOperationalInsights(order, universe),
    },
  }
}