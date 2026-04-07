export const DEFAULT_STUCK_PAID_THRESHOLD_MINUTES = 20
export const DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES = 15

export function normalizeThresholdMinutes(
  rawValue: number | string | null | undefined,
  fallbackMinutes = DEFAULT_STUCK_PAID_THRESHOLD_MINUTES
) {
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackMinutes
  }

  return Math.floor(parsedValue)
}

type PaidOrderAlertCandidate = {
  id: string
  status: string
  updatedAt: string
}

export function getPaidOrderAgeMinutes(updatedAt: string, now = Date.now()) {
  const updatedAtTime = new Date(updatedAt).getTime()

  if (!Number.isFinite(updatedAtTime)) {
    return 0
  }

  return Math.max(0, Math.floor((now - updatedAtTime) / 60000))
}

export function enrichPaidOrderAlert<T extends PaidOrderAlertCandidate>(order: T, thresholdMinutes = DEFAULT_STUCK_PAID_THRESHOLD_MINUTES, now = Date.now()) {
  const ageMinutes = getPaidOrderAgeMinutes(order.updatedAt, now)

  return {
    ...order,
    ageMinutes,
    isStuck: order.status === "paid" && ageMinutes >= thresholdMinutes
  }
}

export function getStuckPaidOrders<T extends PaidOrderAlertCandidate>(orders: T[], thresholdMinutes = DEFAULT_STUCK_PAID_THRESHOLD_MINUTES, now = Date.now()) {
  return orders
    .map((order) => enrichPaidOrderAlert(order, thresholdMinutes, now))
    .filter((order) => order.isStuck)
    .sort((left, right) => right.ageMinutes - left.ageMinutes)
}

export type ManualBillingEscalationKind = "quote_requested_sla" | "paid_sla"

export type ManualBillingEscalationCandidate = PaidOrderAlertCandidate & {
  service?: string
  customer?: {
    customerName?: string
    customerEmail?: string
    recipientName?: string
  }
  metadata?: {
    insights?: {
      priority?: "low" | "medium" | "high"
      duplicateRisk?: "low" | "medium" | "high"
      suggestedNextAction?: string
    }
  }
}

export function getStuckQuoteRequestedOrders<T extends PaidOrderAlertCandidate>(orders: T[], thresholdMinutes = DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES, now = Date.now()) {
  return orders
    .map((order) => enrichPaidOrderAlert(order, thresholdMinutes, now))
    .filter((order) => order.status === "quote_requested" && order.ageMinutes >= thresholdMinutes)
    .sort((left, right) => right.ageMinutes - left.ageMinutes)
}

export function getManualBillingEscalations<T extends ManualBillingEscalationCandidate>(
  orders: T[],
  options: {
    quoteRequestedThresholdMinutes?: number
    paidThresholdMinutes?: number
    now?: number
  } = {}
) {
  const now = options.now ?? Date.now()
  const quoteRequestedThresholdMinutes = options.quoteRequestedThresholdMinutes ?? DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES
  const paidThresholdMinutes = options.paidThresholdMinutes ?? DEFAULT_STUCK_PAID_THRESHOLD_MINUTES

  const quoteEscalations = getStuckQuoteRequestedOrders(orders, quoteRequestedThresholdMinutes, now).map((order) => ({
    ...order,
    escalationKind: "quote_requested_sla" as ManualBillingEscalationKind,
    escalationLabel: "Quote lookup overdue",
  }))

  const paidEscalations = getStuckPaidOrders(orders, paidThresholdMinutes, now).map((order) => ({
    ...order,
    escalationKind: "paid_sla" as ManualBillingEscalationKind,
    escalationLabel: "Operator completion overdue",
  }))

  return [...quoteEscalations, ...paidEscalations].sort((left, right) => right.ageMinutes - left.ageMinutes)
}