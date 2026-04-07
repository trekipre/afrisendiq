import type { PricingDecision, PricingStrategy } from "@/app/lib/profitEngine"

export type ManualBillingService = "sodeci" | "cie-postpaid" | "cie-prepaid" | "canal-plus"

export type ManualBillingStatus =
  | "quote_requested"
  | "quote_ready"
  | "payment_pending"
  | "paid"
  | "operator_started"
  | "operator_confirmed"
  | "completed"
  | "failed"

export type ManualBillingTransition = {
  from: ManualBillingStatus | null
  to: ManualBillingStatus
  changedAt: string
  note?: string
}

export type ManualBillingCustomerDetails = {
  customerName: string
  customerEmail: string
  customerPhone?: string
  recipientName: string
}

export type ManualBillingAuditChannel =
  | "stripe_webhook"
  | "telegram_send"
  | "telegram_callback"
  | "whatsapp_send"
  | "admin"
  | "automation"
  | "system"

export type ManualBillingAuditOutcome =
  | "attempted"
  | "received"
  | "processed"
  | "delivered"
  | "duplicate"
  | "failed"
  | "skipped"

export type ManualBillingAuditEvent = {
  id: string
  channel: ManualBillingAuditChannel
  event: string
  outcome: ManualBillingAuditOutcome
  recordedAt: string
  detail?: string
  payload?: Record<string, unknown>
}

export type ManualBillingPricingSummary = {
  source: "manual-billing-profit-engine"
  inputAmount: number
  providerCost: number
  customerPrice: number
  afrisendiqMargin: number
  afrisendiqMarginPercent: number
  pricingStrategy: PricingStrategy
  pricingDecision: PricingDecision
}

export type ManualBillingInsightPriority = "low" | "medium" | "high"

export type ManualBillingDuplicateRisk = "low" | "medium" | "high"

export type ManualBillingAutomationStatus =
  | "new_request"
  | "resume_existing"
  | "needs_manual_quote"
  | "payment_ready"
  | "awaiting_operator"
  | "completed"
  | "failed"

export type ManualBillingLookupSource = "external_http" | "fixture" | "historical"

export type ManualBillingLookupConfidence = "low" | "medium" | "high"

export type ManualBillingLookupResult = {
  status: "found" | "not_found" | "unavailable"
  source: ManualBillingLookupSource
  confidence: ManualBillingLookupConfidence
  amount?: number
  currency?: "XOF"
  detail?: string
  providerReference?: string
  lookedUpAt: string
}

export type ManualBillingOperationalInsights = {
  normalizedAccountReference: string
  duplicateRisk: ManualBillingDuplicateRisk
  priority: ManualBillingInsightPriority
  automationStatus: ManualBillingAutomationStatus
  suggestedNextAction: string
  relatedOpenOrders: number
  relatedCompletedOrders: number
  recentOrderCount: number
  knownAccount: boolean
  resumableOrderId?: string
  resumedExistingOrder?: boolean
  lastCompletedOrderId?: string
  lastKnownBillAmount?: number
  lastKnownQuotedAmount?: number
}

export type ManualBillingFulfillment = {
  deliveryMethod: "token" | "receipt" | "confirmation"
  customerPhone?: string
  whatsappTarget?: string
  whatsappHref?: string
  whatsappMessageSid?: string
  token?: string
  units?: string
  receiptReference?: string
  note?: string
  deliveredAt?: string
  lastUpdatedAt?: string
  lastUpdatedBy?: "admin" | "telegram" | "automation"
}

export type ManualBillingDeliveryChannel = "sms" | "whatsapp" | "in_app"

export type ManualBillingSavedRecipientMetadata = {
  requested?: boolean
  recipientProfileId?: string
  matchedExisting?: boolean
  preferredDeliveryChannel?: ManualBillingDeliveryChannel
}

export type ManualBillingDeliveryTarget = {
  channel: ManualBillingDeliveryChannel
  reason: string
  recipientProfileId?: string
  resolvedAt: string
}

export type ManualBillingWhatsAppNotification = {
  messageSid?: string
  status?: string
  statusRecordedAt?: string
  deliveredAt?: string
  readAt?: string
  callbackPayload?: Record<string, unknown>
}

export type ManualBillingPrimarySmsNotification = {
  provider?: "twilio" | "orange" | "mtn" | "africasTalking" | "tpeCloud"
  target?: string
  message?: string
  messageSid?: string
  resourceId?: string
  requestId?: string
  transactionId?: string
  clientCorrelator?: string
  messageId?: string
  cost?: string
  status?: string
  statusCode?: number
  summaryMessage?: string
  sentAt?: string
  deliveredAt?: string
  lastUpdatedAt?: string
  lastFailureReason?: string
  manualShareRequired?: boolean
  retryCount?: number
  callbackPayload?: Record<string, unknown>
}

export type ManualBillingInAppNotification = {
  status?: "queued" | "delivered"
  recipientProfileId?: string
  deliveredAt?: string
  lastUpdatedAt?: string
}

export type ManualBillingOrangeFallbackNotification = {
  enabled?: boolean
  target?: string
  message?: string
  resourceId?: string
  resourceUrl?: string
  status?: string
  sentAt?: string
  lastEvaluatedAt?: string
  skippedReason?: string
  callbackPayload?: Record<string, unknown>
}

export type ManualBillingTwilioSmsFallbackNotification = {
  enabled?: boolean
  target?: string
  message?: string
  messageSid?: string
  status?: string
  sentAt?: string
  lastEvaluatedAt?: string
  skippedReason?: string
  callbackPayload?: Record<string, unknown>
}

export type ManualBillingMtnFallbackNotification = {
  enabled?: boolean
  target?: string
  message?: string
  requestId?: string
  transactionId?: string
  clientCorrelator?: string
  resourceUrl?: string
  status?: string
  sentAt?: string
  lastEvaluatedAt?: string
  skippedReason?: string
  callbackPayload?: Record<string, unknown>
}

export type ManualBillingAfricasTalkingFallbackNotification = {
  enabled?: boolean
  target?: string
  message?: string
  messageId?: string
  cost?: string
  status?: string
  statusCode?: number
  summaryMessage?: string
  sentAt?: string
  lastEvaluatedAt?: string
  skippedReason?: string
  callbackPayload?: Record<string, unknown>
}

export type ManualBillingTpeCloudFallbackNotification = {
  enabled?: boolean
  target?: string
  message?: string
  messageId?: string
  status?: string
  sentAt?: string
  lastEvaluatedAt?: string
  skippedReason?: string
  callbackPayload?: Record<string, unknown>
}

export type ManualBillingNotifications = {
  primarySms?: ManualBillingPrimarySmsNotification
  inAppDelivery?: ManualBillingInAppNotification
  whatsapp?: ManualBillingWhatsAppNotification
  twilioSmsFallback?: ManualBillingTwilioSmsFallbackNotification
  orangeFallback?: ManualBillingOrangeFallbackNotification
  mtnFallback?: ManualBillingMtnFallbackNotification
  africasTalkingFallback?: ManualBillingAfricasTalkingFallbackNotification
  tpeCloudFallback?: ManualBillingTpeCloudFallbackNotification
}

export type ManualBillingMetadata = Record<string, unknown> & {
  autoCompleteOperator?: boolean
  auditTrail?: ManualBillingAuditEvent[]
  manualPricing?: ManualBillingPricingSummary
  normalizedAccountReference?: string
  insights?: ManualBillingOperationalInsights
  lookup?: ManualBillingLookupResult
  savedRecipient?: ManualBillingSavedRecipientMetadata
  deliveryTarget?: ManualBillingDeliveryTarget
  fulfillment?: ManualBillingFulfillment
  notifications?: ManualBillingNotifications
}

export type ManualBillingOrder = {
  id: string
  traceId: string
  service: ManualBillingService
  countryCode: "CI"
  accountReference: string
  packageCode?: string
  packageLabel?: string
  quotedAmount?: number
  currency: "XOF"
  status: ManualBillingStatus
  paymentSessionId?: string
  stripePaymentStatus?: "pending" | "paid" | "refunded"
  adminQuoteNotes?: string
  adminExecutionNotes?: string
  telegramMessageId?: string
  pricingSummary?: ManualBillingPricingSummary
  metadata?: ManualBillingMetadata
  failureReason?: string
  customer: ManualBillingCustomerDetails
  createdAt: string
  updatedAt: string
  transitions: ManualBillingTransition[]
}

const orderStore = new Map<string, ManualBillingOrder>()

const allowedTransitions: Record<ManualBillingStatus, ManualBillingStatus[]> = {
  quote_requested: ["quote_ready", "failed"],
  quote_ready: ["payment_pending", "failed"],
  payment_pending: ["paid", "failed"],
  paid: ["operator_started", "failed"],
  operator_started: ["operator_confirmed", "failed"],
  operator_confirmed: ["completed", "failed"],
  completed: [],
  failed: []
}

function persistOrder(order: ManualBillingOrder) {
  orderStore.set(order.id, order)
  return order
}

export function createManualBillingOrder(
  input: Omit<ManualBillingOrder, "status" | "createdAt" | "updatedAt" | "transitions">
) {
  const now = new Date().toISOString()

  return persistOrder({
    ...input,
    status: "quote_requested",
    createdAt: now,
    updatedAt: now,
    transitions: [
      {
        from: null,
        to: "quote_requested",
        changedAt: now,
        note: "Manual billing order created"
      }
    ]
  })
}

export function getManualBillingOrder(orderId: string) {
  return orderStore.get(orderId)
}

export function listManualBillingOrders() {
  return [...orderStore.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function resetManualBillingOrders() {
  orderStore.clear()
}

export function transitionManualBillingOrder(
  order: ManualBillingOrder,
  nextStatus: ManualBillingStatus,
  patch: Partial<Omit<ManualBillingOrder, "id" | "traceId" | "createdAt" | "transitions">> = {},
  note?: string
) {
  if (!allowedTransitions[order.status].includes(nextStatus)) {
    throw new Error(`Invalid manual billing transition from ${order.status} to ${nextStatus}`)
  }

  const changedAt = new Date().toISOString()

  return persistOrder({
    ...order,
    ...patch,
    status: nextStatus,
    updatedAt: changedAt,
    transitions: [
      ...order.transitions,
      {
        from: order.status,
        to: nextStatus,
        changedAt,
        note
      }
    ]
  })
}

export function patchManualBillingOrder(
  order: ManualBillingOrder,
  patch: Partial<Omit<ManualBillingOrder, "id" | "traceId" | "createdAt" | "transitions">>
) {
  const updated = {
    ...order,
    ...patch,
    updatedAt: new Date().toISOString()
  }

  return persistOrder(updated)
}

export function getManualBillingAuditTrail(order: ManualBillingOrder) {
  const auditTrail = order.metadata?.auditTrail

  if (!Array.isArray(auditTrail)) {
    return []
  }

  return auditTrail
}

export function appendManualBillingAuditEvent(
  order: ManualBillingOrder,
  auditEvent: ManualBillingAuditEvent
) {
  const auditTrail = [...getManualBillingAuditTrail(order), auditEvent].slice(-50)

  return patchManualBillingOrder(order, {
    metadata: {
      ...(order.metadata ?? {}),
      auditTrail
    }
  })
}