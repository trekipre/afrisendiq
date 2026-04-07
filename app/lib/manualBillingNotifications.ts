import type { ManualBillingAlertSettings, ManualBillingSmsRouteCarrier, ManualBillingSmsRouteMessageType } from "@/app/lib/internalSettings"
import type { ManualBillingFulfillment, ManualBillingOrder } from "@/app/lib/manualBillingState"
import { toAsciiSmsText } from "@/app/lib/smsText"

export type OrangeFallbackDecision = {
  eligible: boolean
  reason: string
  evaluateAfter?: string
}

export type TwilioSmsFallbackDecision = OrangeFallbackDecision

export type MtnFallbackDecision = OrangeFallbackDecision
export type AfricasTalkingFallbackDecision = OrangeFallbackDecision
export type TpeCloudFallbackDecision = OrangeFallbackDecision

function normalizePhoneDigits(rawValue?: string) {
  if (!rawValue) {
    return ""
  }

  let digits = rawValue.replace(/\D/g, "")

  if (digits.startsWith("00225")) {
    digits = digits.slice(5)
  } else if (digits.startsWith("225") && digits.length > 10) {
    digits = digits.slice(3)
  }

  return digits
}

function hasPriorSmsFallbackAttempt(order: ManualBillingOrder) {
  const notifications = order.metadata?.notifications

  return Boolean(
    notifications?.twilioSmsFallback?.lastEvaluatedAt ||
    notifications?.orangeFallback?.lastEvaluatedAt ||
    notifications?.mtnFallback?.lastEvaluatedAt ||
    notifications?.africasTalkingFallback?.lastEvaluatedAt ||
    notifications?.tpeCloudFallback?.lastEvaluatedAt
  )
}

export function detectManualBillingSmsCarrier(rawPhone?: string): ManualBillingSmsRouteCarrier {
  const digits = normalizePhoneDigits(rawPhone)

  if (/^05/.test(digits)) {
    return "mtn-ci"
  }

  if (/^07/.test(digits)) {
    return "orange-ci"
  }

  if (/^01/.test(digits)) {
    return "moov-ci"
  }

  return "unknown-ci"
}

export function getManualBillingSmsRouteMessageType(order: ManualBillingOrder): ManualBillingSmsRouteMessageType {
  if (hasPriorSmsFallbackAttempt(order)) {
    return "retry"
  }

  return order.metadata?.fulfillment?.deliveryMethod ?? "confirmation"
}

function getCompletedAt(order: ManualBillingOrder) {
  return order.transitions.find((transition) => transition.to === "completed")?.changedAt || order.metadata?.fulfillment?.deliveredAt || order.updatedAt
}

function buildManualBillingDescriptor(order: ManualBillingOrder) {
  if (order.service === "cie-prepaid") {
    return "compteur CIE prepaye"
  }

  if (order.service === "cie-postpaid") {
    return "facture CIE payée"
  }

  if (order.service === "sodeci") {
    return "facture SODECI payée"
  }

  return order.packageLabel?.trim() ? `abo ${order.packageLabel.trim()}` : "abo Canal+"
}

function buildRichManualBillingDescriptor(order: ManualBillingOrder) {
  if (order.service === "cie-prepaid") {
    return "recharge de compteur prepaye"
  }

  if (order.service === "cie-postpaid") {
    return "facture CIE payee"
  }

  if (order.service === "sodeci") {
    return "facture SODECI payee"
  }

  return order.packageLabel?.trim() ? `abonnement ${order.packageLabel.trim()}` : "abonnement Canal+"
}

function buildDescriptorPrefix(descriptor: string) {
  return /^[aeiouyh]/i.test(descriptor) ? "d'" : "de "
}

export function buildCustomerFulfillmentSmsMessage(order: ManualBillingOrder, fulfillment: ManualBillingFulfillment) {
  const descriptor = buildManualBillingDescriptor(order)
  const senderName = order.customer.customerName.trim() || "AfriSendIQ"
  const introLine = `Soutrali: ${descriptor}. De ${senderName} via AfriSendIQ.`

  if (fulfillment.deliveryMethod === "token") {
    const tokenLine = fulfillment.token ? `Token ${fulfillment.token}` : null
    const unitsLine = fulfillment.units ? `Units ${fulfillment.units}` : null

    if (!tokenLine && !unitsLine) {
      return null
    }

    return toAsciiSmsText([
      introLine,
      tokenLine,
      unitsLine,
      `Ref ${order.id}`,
      "afrisendiq.com",
    ].filter(Boolean).join("\n"))
  }

  if (fulfillment.deliveryMethod === "receipt" && fulfillment.receiptReference) {
    return toAsciiSmsText([
      introLine,
      `Ref ${fulfillment.receiptReference}`,
      `Cmd ${order.id}`,
      "afrisendiq.com",
    ].join("\n"))
  }

  return toAsciiSmsText([
    introLine,
    `Ref ${order.id}`,
    "afrisendiq.com",
  ].join("\n"))
}

export function buildCustomerFulfillmentWhatsAppMessage(order: ManualBillingOrder, fulfillment: ManualBillingFulfillment) {
  const descriptor = buildRichManualBillingDescriptor(order)
  const senderName = order.customer.customerName.trim() || "AfriSendIQ"
  const introLine = `Vous avez recu un Soutrali ${buildDescriptorPrefix(descriptor)}${descriptor}, par le service Soutrali d'AfriSendIQ, de la part de ${senderName}.`

  if (fulfillment.deliveryMethod === "token") {
    const tokenLine = fulfillment.token ? `Token: ${fulfillment.token}` : null
    const unitsLine = fulfillment.units ? `Units: ${fulfillment.units}` : null

    if (!tokenLine && !unitsLine) {
      return null
    }

    return [
      introLine,
      tokenLine,
      unitsLine,
      `Reference : ${order.id}`,
      "www.AfriSendIQ.com",
    ].filter(Boolean).join("\n")
  }

  if (fulfillment.deliveryMethod === "receipt" && fulfillment.receiptReference) {
    return [
      introLine,
      `Reference : ${fulfillment.receiptReference}`,
      `Commande : ${order.id}`,
      "www.AfriSendIQ.com",
    ].join("\n")
  }

  return [
    introLine,
    `Reference : ${order.id}`,
    "www.AfriSendIQ.com",
  ].join("\n")
}

export function buildCustomerFulfillmentMessage(order: ManualBillingOrder, fulfillment: ManualBillingFulfillment) {
  return buildCustomerFulfillmentSmsMessage(order, fulfillment)
}

function getSmsFallbackDecision(
  order: ManualBillingOrder,
  options: {
    enabled: boolean
    providerLabel: string
    alreadySent: boolean
  },
  fallbackDelayMinutes: number,
  now = new Date()
): OrangeFallbackDecision {
  if (!options.enabled) {
    return {
      eligible: false,
      reason: `${options.providerLabel} SMS fallback is disabled`,
    }
  }

  if (order.status !== "completed") {
    return {
      eligible: false,
      reason: "Order is not completed",
    }
  }

  const fulfillment = order.metadata?.fulfillment
  const notifications = order.metadata?.notifications

  if (!fulfillment?.customerPhone) {
    return {
      eligible: false,
      reason: "No customer phone is available for fallback SMS",
    }
  }

  if (options.alreadySent) {
    return {
      eligible: false,
      reason: `${options.providerLabel} fallback SMS was already sent`,
    }
  }

  if (notifications?.primarySms?.sentAt || notifications?.primarySms?.deliveredAt) {
    return {
      eligible: false,
      reason: "Primary SMS delivery was already sent",
    }
  }

  if (notifications?.whatsapp?.readAt) {
    return {
      eligible: false,
      reason: "WhatsApp confirmation has already been read",
    }
  }

  const completedAt = getCompletedAt(order)
  const evaluateAfter = new Date(new Date(completedAt).getTime() + fallbackDelayMinutes * 60_000)

  if (now < evaluateAfter) {
    return {
      eligible: false,
      reason: "Fallback delay window has not elapsed yet",
      evaluateAfter: evaluateAfter.toISOString(),
    }
  }

  return {
    eligible: true,
    reason: "WhatsApp read receipt is still missing after the fallback delay window",
    evaluateAfter: evaluateAfter.toISOString(),
  }
}

export function getOrangeFallbackDecision(
  order: ManualBillingOrder,
  settings: Pick<ManualBillingAlertSettings, "orangeFallbackEnabled" | "whatsappFallbackDelayMinutes">,
  now = new Date()
): OrangeFallbackDecision {
  return getSmsFallbackDecision(order, {
    enabled: settings.orangeFallbackEnabled,
    providerLabel: "Orange",
    alreadySent: Boolean(order.metadata?.notifications?.orangeFallback?.sentAt || order.metadata?.notifications?.orangeFallback?.resourceId),
  }, settings.whatsappFallbackDelayMinutes, now)
}

export function getTwilioSmsFallbackDecision(
  order: ManualBillingOrder,
  settings: Pick<ManualBillingAlertSettings, "twilioSmsFallbackEnabled" | "whatsappFallbackDelayMinutes">,
  now = new Date()
): TwilioSmsFallbackDecision {
  return getSmsFallbackDecision(order, {
    enabled: settings.twilioSmsFallbackEnabled,
    providerLabel: "Twilio",
    alreadySent: Boolean(order.metadata?.notifications?.twilioSmsFallback?.sentAt || order.metadata?.notifications?.twilioSmsFallback?.messageSid),
  }, settings.whatsappFallbackDelayMinutes, now)
}

export function getMtnFallbackDecision(
  order: ManualBillingOrder,
  settings: Pick<ManualBillingAlertSettings, "mtnFallbackEnabled" | "whatsappFallbackDelayMinutes">,
  now = new Date()
): MtnFallbackDecision {
  return getSmsFallbackDecision(order, {
    enabled: settings.mtnFallbackEnabled,
    providerLabel: "MTN",
    alreadySent: Boolean(order.metadata?.notifications?.mtnFallback?.sentAt || order.metadata?.notifications?.mtnFallback?.requestId || order.metadata?.notifications?.mtnFallback?.transactionId),
  }, settings.whatsappFallbackDelayMinutes, now)
}

export function getAfricasTalkingFallbackDecision(
  order: ManualBillingOrder,
  settings: Pick<ManualBillingAlertSettings, "africasTalkingFallbackEnabled" | "whatsappFallbackDelayMinutes">,
  now = new Date()
): AfricasTalkingFallbackDecision {
  return getSmsFallbackDecision(order, {
    enabled: settings.africasTalkingFallbackEnabled,
    providerLabel: "AfricasTalking",
    alreadySent: Boolean(order.metadata?.notifications?.africasTalkingFallback?.sentAt || order.metadata?.notifications?.africasTalkingFallback?.messageId),
  }, settings.whatsappFallbackDelayMinutes, now)
}

export function getTpeCloudFallbackDecision(
  order: ManualBillingOrder,
  settings: Pick<ManualBillingAlertSettings, "tpeCloudFallbackEnabled" | "whatsappFallbackDelayMinutes">,
  now = new Date()
): TpeCloudFallbackDecision {
  return getSmsFallbackDecision(order, {
    enabled: settings.tpeCloudFallbackEnabled,
    providerLabel: "TPECloud",
    alreadySent: Boolean(order.metadata?.notifications?.tpeCloudFallback?.sentAt || order.metadata?.notifications?.tpeCloudFallback?.messageId),
  }, settings.whatsappFallbackDelayMinutes, now)
}