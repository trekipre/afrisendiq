import { stripePaymentService } from "@/app/lib/services/paymentService"
import {
  appendManualBillingAuditEvent,
  createManualBillingOrder,
  getManualBillingAuditTrail,
  getManualBillingOrder,
  listManualBillingOrders,
  type ManualBillingPricingSummary,
  patchManualBillingOrder,
  transitionManualBillingOrder,
  type ManualBillingAuditChannel,
  type ManualBillingAuditEvent,
  type ManualBillingAuditOutcome,
  type ManualBillingFulfillment,
  type ManualBillingOrder,
  type ManualBillingService
} from "@/app/lib/manualBillingState"
import {
  fetchManualBillingOrder,
  listManualBillingAuditEvents,
  listManualBillingOrdersFromSupabase,
  persistManualBillingAuditEvent,
  persistManualBillingOrder
} from "@/app/lib/manualBillingSupabase"
import {
  findResumableManualOrder,
  normalizeManualBillingPhone,
  validateManualBillingDraft,
  withManualBillingOperationalInsights,
} from "@/app/lib/manualBillingIntelligence"
import { lookupManualBillAmount } from "@/app/lib/manualBillLookup"
import { computeOptimalPrice, type ProfitEngineDependencies } from "@/app/lib/profitEngine"
import { getLearnedProfitEngineConfigOverride } from "@/app/lib/profitEngineLearning"
import { getDefaultManualBillingSmsRoutingPolicy, getManualBillingAlertSettings, type ManualBillingSmsProvider, type ManualBillingSmsRouteMessageType } from "@/app/lib/internalSettings"
import { buildCustomerFulfillmentSmsMessage, buildCustomerFulfillmentWhatsAppMessage, detectManualBillingSmsCarrier, getAfricasTalkingFallbackDecision, getManualBillingSmsRouteMessageType, getMtnFallbackDecision, getOrangeFallbackDecision, getTpeCloudFallbackDecision, getTwilioSmsFallbackDecision } from "@/app/lib/manualBillingNotifications"
import { isAfricasTalkingSmsConfigured, sendAfricasTalkingSmsMessage } from "@/app/lib/africasTalkingSms"
import { isMtnSmsConfigured, sendMtnSmsMessage } from "@/app/lib/mtnSms"
import { isOrangeSmsConfigured, sendOrangeSmsMessage } from "@/app/lib/orangeSms"
import { isTpeCloudSmsConfigured, sendTpeCloudSmsMessage } from "@/app/lib/tpeCloudSms"
import { buildWhatsAppHref, getTwilioSmsStatusCallbackUrl, getTwilioWhatsAppStatusCallbackUrl, getTwilioSmsConfig, sendTwilioSmsMessage, sendTwilioWhatsAppMessage } from "@/app/lib/whatsapp"

type CreateManualOrderInput = {
  service: ManualBillingService
  accountReference: string
  packageCode?: string
  packageLabel?: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  recipientName: string
  metadata?: Record<string, unknown>
}

type AdminQuoteInput = {
  orderId: string
  quotedAmount: number
  adminQuoteNotes?: string
}

type AdminFailureInput = {
  orderId: string
  failureReason: string
  adminExecutionNotes?: string
}

type TelegramButtonAction = "start" | "confirm" | "complete"
type OperatorActionSource = "telegram" | "admin" | "automation"
type ManualFulfillmentInput = {
  customerPhone?: string
  token?: string
  units?: string
  receiptReference?: string
  note?: string
}
type ManualOrderResponse = ManualBillingOrder & {
  auditEvents: ManualBillingAuditEvent[]
  pricingSummary?: ManualBillingPricingSummary
}

type ManualBillingFallbackSettingsOverride = Partial<Pick<
  Awaited<ReturnType<typeof getManualBillingAlertSettings>>,
  "twilioSmsFallbackEnabled" | "orangeFallbackEnabled" | "mtnFallbackEnabled" | "africasTalkingFallbackEnabled" | "tpeCloudFallbackEnabled" | "whatsappFallbackDelayMinutes" | "routingPolicy"
>>

type ManualBillingOpsTestHookInput = {
  orderId?: string
  createOrder?: CreateManualOrderInput
  quotedAmount?: number
  createCheckoutSession?: boolean
  markPaid?: boolean
  paymentSessionId?: string
  autoProgress?: boolean
  fulfillment?: ManualFulfillmentInput
  fallback?: {
    dryRun?: boolean
    limit?: number
    overrideNow?: Date
    settingsOverride?: ManualBillingFallbackSettingsOverride
  }
}

const CANAL_PLUS_PACKAGES = [
  { code: "access", label: "Canal+ Access", amount: 5000 },
  { code: "evasion", label: "Canal+ Evasion", amount: 10000 },
  { code: "essentiel", label: "Canal+ Essentiel", amount: 15000 },
  { code: "tout-canal", label: "Canal+ Tout Canal", amount: 25000 }
] as const

const CIE_PREPAID_AMOUNT_OPTIONS = [
  { code: "5000", label: "CIE Prépayé 5 000 XOF", amount: 5000 },
  { code: "10000", label: "CIE Prépayé 10 000 XOF", amount: 10000 },
  { code: "20000", label: "CIE Prépayé 20 000 XOF", amount: 20000 },
  { code: "50000", label: "CIE Prépayé 50 000 XOF", amount: 50000 }
] as const

function createOrderId(service: ManualBillingService) {
  return `${service.toUpperCase()}-${Date.now()}`
}

function createTraceId() {
  return crypto.randomUUID()
}

function getSmsFallbackProviderEvent(provider: ManualBillingSmsProvider) {
  if (provider === "tpeCloud") {
    return "manual_billing.tpecloud_fallback_sms"
  }

  if (provider === "twilio") {
    return "manual_billing.twilio_sms_fallback"
  }

  if (provider === "orange") {
    return "manual_billing.orange_fallback_sms"
  }

  if (provider === "mtn") {
    return "manual_billing.mtn_fallback_sms"
  }

  return "manual_billing.africas_talking_fallback_sms"
}

function getSmsFallbackProviderLabel(provider: ManualBillingSmsProvider) {
  if (provider === "tpeCloud") {
    return "TPECloud"
  }

  if (provider === "africasTalking") {
    return "AfricasTalking"
  }

  if (provider === "mtn") {
    return "MTN"
  }

  if (provider === "orange") {
    return "Orange"
  }

  return "Twilio"
}

function isSmsFallbackProviderConfigured(provider: ManualBillingSmsProvider) {
  if (provider === "tpeCloud") {
    return isTpeCloudSmsConfigured()
  }

  if (provider === "twilio") {
    const twilioConfig = getTwilioSmsConfig()
    return Boolean(twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.from)
  }

  if (provider === "orange") {
    return isOrangeSmsConfigured()
  }

  if (provider === "mtn") {
    return isMtnSmsConfigured()
  }

  return isAfricasTalkingSmsConfigured()
}

function withSmsFallbackAttemptRecorded(
  order: ManualBillingOrder,
  provider: ManualBillingSmsProvider,
  target: string,
  message: string,
  attemptedAt: string,
  failureReason: string
) {
  if (provider === "tpeCloud") {
    return withMergedMetadata(order, {
      notifications: {
        ...(order.metadata?.notifications ?? {}),
        tpeCloudFallback: {
          ...(order.metadata?.notifications?.tpeCloudFallback ?? {}),
          enabled: true,
          target,
          message,
          status: "failed",
          lastEvaluatedAt: attemptedAt,
          skippedReason: failureReason,
        },
      },
    })
  }

  if (provider === "twilio") {
    return withMergedMetadata(order, {
      notifications: {
        ...(order.metadata?.notifications ?? {}),
        twilioSmsFallback: {
          ...(order.metadata?.notifications?.twilioSmsFallback ?? {}),
          enabled: true,
          target,
          message,
          status: "failed",
          lastEvaluatedAt: attemptedAt,
          skippedReason: failureReason,
        },
      },
    })
  }

  if (provider === "orange") {
    return withMergedMetadata(order, {
      notifications: {
        ...(order.metadata?.notifications ?? {}),
        orangeFallback: {
          ...(order.metadata?.notifications?.orangeFallback ?? {}),
          enabled: true,
          target,
          message,
          status: "failed",
          lastEvaluatedAt: attemptedAt,
          skippedReason: failureReason,
        },
      },
    })
  }

  if (provider === "mtn") {
    return withMergedMetadata(order, {
      notifications: {
        ...(order.metadata?.notifications ?? {}),
        mtnFallback: {
          ...(order.metadata?.notifications?.mtnFallback ?? {}),
          enabled: true,
          target,
          message,
          status: "failed",
          lastEvaluatedAt: attemptedAt,
          skippedReason: failureReason,
        },
      },
    })
  }

  return withMergedMetadata(order, {
    notifications: {
      ...(order.metadata?.notifications ?? {}),
      africasTalkingFallback: {
        ...(order.metadata?.notifications?.africasTalkingFallback ?? {}),
        enabled: true,
        target,
        message,
        status: "failed",
        lastEvaluatedAt: attemptedAt,
        skippedReason: failureReason,
      },
    },
  })
}

function getBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}

function getAutoCompletionServices() {
  return String(process.env.MANUAL_BILLING_AUTO_COMPLETE_SERVICES || "")
    .split(",")
    .map((service) => service.trim().toLowerCase())
    .filter(Boolean)
}

function shouldAutoCompleteManualOrder(order: ManualBillingOrder) {
  const metadataAutoComplete = order.metadata?.autoCompleteOperator
  if (typeof metadataAutoComplete === "boolean") {
    return metadataAutoComplete
  }

  return getAutoCompletionServices().includes(order.service)
}

function getOperatorActionTransitionNote(action: TelegramButtonAction, source: OperatorActionSource) {
  const sourceLabel = source === "telegram"
    ? "Telegram operator action"
    : source === "admin"
      ? "Admin operator action"
      : "Automated operator action"

  if (action === "start") {
    return `${sourceLabel}: operator started manual phone flow`
  }

  if (action === "confirm") {
    return `${sourceLabel}: operator confirmed payment submission`
  }

  return `${sourceLabel}: operator marked order complete`
}

function getManualBillingProductId(service: ManualBillingService, packageCode?: string) {
  return packageCode ? `manual-${service}-${packageCode}` : `manual-${service}`
}

function getManualBillingCustomerPath(service: ManualBillingService) {
  if (service === "cie-prepaid") {
    return "/cote-divoire/cie-prepaid"
  }

  return `/cote-divoire/${service}`
}

function createManualPricingDependencies(baseAmount: number): ProfitEngineDependencies {
  return {
    getCompetitorPrices: async () => [],
    getProviderCosts: async (productId) => [{
      provider: "manual-billing",
      productId,
      amount: baseAmount,
      currency: "XOF",
      providerCost: baseAmount,
      fetchedAt: new Date().toISOString()
    }]
  }
}

async function quoteManualBillingAmount(
  service: ManualBillingService,
  baseAmount: number,
  options: { packageCode?: string } = {}
): Promise<ManualBillingPricingSummary> {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    throw new Error("Manual billing base amount must be greater than zero")
  }

  const learnedProfitConfig = await getLearnedProfitEngineConfigOverride()

  const pricingDecision = await computeOptimalPrice(
    {
      productId: getManualBillingProductId(service, options.packageCode),
      productType: `manual-${service}`,
      amount: baseAmount,
      currency: "XOF",
      paymentMethod: "manual",
      userCountryCode: "CI"
    },
    createManualPricingDependencies(baseAmount),
    {
      ...learnedProfitConfig,
      fxSpreadCaptureBps: 0
    }
  )

  return {
    source: "manual-billing-profit-engine",
    inputAmount: baseAmount,
    providerCost: baseAmount,
    customerPrice: pricingDecision.customerPrice,
    afrisendiqMargin: pricingDecision.netMarginAfterCosts,
    afrisendiqMarginPercent: pricingDecision.netMarginAfterCostsPercent,
    pricingStrategy: pricingDecision.strategy,
    pricingDecision
  }
}

function toManualOrderResponse(order: ManualBillingOrder): ManualOrderResponse {
  return {
    ...order,
    auditEvents: getManualBillingAuditTrail(order),
    pricingSummary: order.pricingSummary ?? order.metadata?.manualPricing
  }
}

function withMergedMetadata(order: ManualBillingOrder, metadataPatch: Record<string, unknown>) {
  return patchManualBillingOrder(order, {
    metadata: {
      ...(order.metadata ?? {}),
      ...metadataPatch,
    },
  })
}

function trimOptionalValue(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function resolveFulfillmentDeliveryMethod(
  order: ManualBillingOrder,
  input: ManualFulfillmentInput,
  existing?: ManualBillingFulfillment
): ManualBillingFulfillment["deliveryMethod"] {
  if (input.token || existing?.token || order.service === "cie-prepaid") {
    return "token"
  }

  if (input.receiptReference || existing?.receiptReference || order.service === "canal-plus") {
    return "receipt"
  }

  return "confirmation"
}

function buildFulfillmentPatch(
  order: ManualBillingOrder,
  source: OperatorActionSource,
  input?: ManualFulfillmentInput,
  deliveredAt?: string
) {
  const existing = order.metadata?.fulfillment
  const customerPhone = trimOptionalValue(input?.customerPhone) ?? existing?.customerPhone ?? order.customer.customerPhone
  const normalizedPhone = normalizeManualBillingPhone(customerPhone)
  const token = trimOptionalValue(input?.token) ?? existing?.token
  const units = trimOptionalValue(input?.units) ?? existing?.units
  const receiptReference = trimOptionalValue(input?.receiptReference) ?? existing?.receiptReference
  const note = trimOptionalValue(input?.note) ?? existing?.note

  if (!normalizedPhone && !token && !units && !receiptReference && !note && !existing && !deliveredAt) {
    return undefined
  }

  return {
    ...existing,
    deliveryMethod: resolveFulfillmentDeliveryMethod(order, input ?? {}, existing),
    customerPhone: normalizedPhone,
    whatsappTarget: normalizedPhone,
    token,
    units,
    receiptReference,
    note,
    deliveredAt: deliveredAt ?? existing?.deliveredAt,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: source,
  } satisfies ManualBillingFulfillment
}

function isManualBillingSmsProviderEnabled(
  settings: Awaited<ReturnType<typeof getManualBillingAlertSettings>>,
  provider: ManualBillingSmsProvider
) {
  if (provider === "tpeCloud") {
    return settings.tpeCloudFallbackEnabled
  }

  if (provider === "twilio") {
    return settings.twilioSmsFallbackEnabled
  }

  if (provider === "orange") {
    return settings.orangeFallbackEnabled
  }

  if (provider === "mtn") {
    return settings.mtnFallbackEnabled
  }

  return settings.africasTalkingFallbackEnabled
}

async function sendManualBillingSmsDelivery(
  order: ManualBillingOrder,
  options: {
    reason: string
    routeMessageType?: ManualBillingSmsRouteMessageType
  }
) {
  const fulfillment = order.metadata?.fulfillment
  const smsMessage = fulfillment ? buildCustomerFulfillmentSmsMessage(order, fulfillment) : null
  const target = fulfillment?.customerPhone
  const now = new Date().toISOString()
  const existingPrimarySms = order.metadata?.notifications?.primarySms ?? {}

  if (!target || !smsMessage) {
    const updatedOrder = withMergedMetadata(order, {
      notifications: {
        ...(order.metadata?.notifications ?? {}),
        primarySms: {
          ...existingPrimarySms,
          status: "unavailable",
          manualShareRequired: true,
          lastFailureReason: "SMS delivery payload is incomplete",
          lastUpdatedAt: now,
        },
      },
    })

    await persistManualBillingOrder(updatedOrder)
    return {
      order: (await recordManualOrderAuditEvent(updatedOrder.id, {
        channel: "automation",
        event: "manual_billing.primary_sms_delivery",
        outcome: "skipped",
        detail: "SMS delivery payload is incomplete",
        payload: {
          reason: options.reason,
        },
      })) ?? updatedOrder,
      sent: false,
      reason: "SMS delivery payload is incomplete",
    }
  }

  const baseSettings = await getManualBillingAlertSettings()
  const settings = {
    ...baseSettings,
    routingPolicy: baseSettings.routingPolicy ?? getDefaultManualBillingSmsRoutingPolicy(),
  }
  const routeMessageType = options.routeMessageType ?? getManualBillingSmsRouteMessageType(order)
  const routingCarrier = detectManualBillingSmsCarrier(target)
  const routingPlan = settings.routingPolicy[routeMessageType][routingCarrier]
  const providerPlan = routingPlan.filter((provider) =>
    isManualBillingSmsProviderEnabled(settings, provider) && isSmsFallbackProviderConfigured(provider)
  )
  const providerIssues = routingPlan
    .filter((provider) => !providerPlan.includes(provider))
    .map((provider) =>
      isManualBillingSmsProviderEnabled(settings, provider)
        ? `${getSmsFallbackProviderLabel(provider)} SMS is not configured`
        : `${getSmsFallbackProviderLabel(provider)} SMS is disabled`
    )

  if (providerPlan.length === 0) {
    const updatedOrder = withMergedMetadata(order, {
      notifications: {
        ...(order.metadata?.notifications ?? {}),
        primarySms: {
          ...existingPrimarySms,
          target,
          message: smsMessage,
          status: "unavailable",
          manualShareRequired: true,
          lastFailureReason: providerIssues.join("; ") || "No SMS fallback provider is available",
          lastUpdatedAt: now,
        },
      },
    })

    await persistManualBillingOrder(updatedOrder)
    return {
      order: (await recordManualOrderAuditEvent(updatedOrder.id, {
        channel: "automation",
        event: "manual_billing.primary_sms_delivery",
        outcome: "skipped",
        detail: providerIssues.join("; ") || "No SMS fallback provider is available",
        payload: {
          reason: options.reason,
          routeMessageType,
          routingCarrier,
          routingPlan,
        },
      })) ?? updatedOrder,
      sent: false,
      reason: providerIssues.join("; ") || "No SMS fallback provider is available",
    }
  }

  let workingOrder = order
  const attemptErrors: string[] = []

  for (const provider of providerPlan) {
    try {
      const retryCount = Number(workingOrder.metadata?.notifications?.primarySms?.retryCount || 0) + 1

      if (provider === "twilio") {
        const twilioMessage = await sendTwilioSmsMessage({
          to: target,
          body: smsMessage,
          statusCallback: getTwilioSmsStatusCallbackUrl(),
        })

        let updatedOrder = withMergedMetadata(workingOrder, {
          notifications: {
            ...(workingOrder.metadata?.notifications ?? {}),
            primarySms: {
              ...(workingOrder.metadata?.notifications?.primarySms ?? {}),
              provider,
              target: twilioMessage.to,
              message: smsMessage,
              messageSid: twilioMessage.sid,
              status: twilioMessage.status || "sent",
              sentAt: now,
              lastUpdatedAt: now,
              manualShareRequired: false,
              lastFailureReason: undefined,
              retryCount,
            },
            twilioSmsFallback: {
              ...(workingOrder.metadata?.notifications?.twilioSmsFallback ?? {}),
              enabled: true,
              target: twilioMessage.to,
                message: smsMessage,
              messageSid: twilioMessage.sid,
              status: twilioMessage.status || "sent",
              sentAt: now,
              lastEvaluatedAt: now,
              skippedReason: undefined,
            },
          },
        })

        await persistManualBillingOrder(updatedOrder)
        updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
          channel: "automation",
          event: "manual_billing.primary_sms_delivery",
          outcome: "delivered",
          detail: `Primary SMS sent via Twilio (${routeMessageType}/${routingCarrier}) after WhatsApp delivery could not be completed`,
          payload: {
            reason: options.reason,
            routeMessageType,
            routingCarrier,
            routingPlan,
            provider,
            messageSid: twilioMessage.sid,
            target: twilioMessage.to,
          },
        })) ?? updatedOrder

        return { order: updatedOrder, sent: true, provider }
      }

      if (provider === "orange") {
        const orangeMessage = await sendOrangeSmsMessage({
          to: target,
          message: smsMessage,
        })

        let updatedOrder = withMergedMetadata(workingOrder, {
          notifications: {
            ...(workingOrder.metadata?.notifications ?? {}),
            primarySms: {
              ...(workingOrder.metadata?.notifications?.primarySms ?? {}),
              provider,
              target: orangeMessage.to,
              message: smsMessage,
              resourceId: orangeMessage.resourceId,
              status: "sent",
              sentAt: now,
              lastUpdatedAt: now,
              manualShareRequired: false,
              lastFailureReason: undefined,
              retryCount,
            },
            orangeFallback: {
              ...(workingOrder.metadata?.notifications?.orangeFallback ?? {}),
              enabled: true,
              target: orangeMessage.to,
                message: smsMessage,
              resourceId: orangeMessage.resourceId,
              resourceUrl: orangeMessage.resourceUrl,
              status: "sent",
              sentAt: now,
              lastEvaluatedAt: now,
              skippedReason: undefined,
            },
          },
        })

        await persistManualBillingOrder(updatedOrder)
        updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
          channel: "automation",
          event: "manual_billing.primary_sms_delivery",
          outcome: "delivered",
          detail: `Primary SMS sent via Orange (${routeMessageType}/${routingCarrier}) after WhatsApp delivery could not be completed`,
          payload: {
            reason: options.reason,
            routeMessageType,
            routingCarrier,
            routingPlan,
            provider,
            resourceId: orangeMessage.resourceId,
            target: orangeMessage.to,
          },
        })) ?? updatedOrder

        return { order: updatedOrder, sent: true, provider }
      }

      if (provider === "mtn") {
        const mtnMessage = await sendMtnSmsMessage({
          to: target,
          message: smsMessage,
        })

        let updatedOrder = withMergedMetadata(workingOrder, {
          notifications: {
            ...(workingOrder.metadata?.notifications ?? {}),
            primarySms: {
              ...(workingOrder.metadata?.notifications?.primarySms ?? {}),
              provider,
              target: mtnMessage.to,
              message: smsMessage,
              requestId: mtnMessage.requestId,
              transactionId: mtnMessage.transactionId,
              clientCorrelator: mtnMessage.clientCorrelator,
              status: mtnMessage.status || "sent",
              sentAt: now,
              lastUpdatedAt: now,
              manualShareRequired: false,
              lastFailureReason: undefined,
              retryCount,
            },
            mtnFallback: {
              ...(workingOrder.metadata?.notifications?.mtnFallback ?? {}),
              enabled: true,
              target: mtnMessage.to,
                message: smsMessage,
              requestId: mtnMessage.requestId,
              transactionId: mtnMessage.transactionId,
              clientCorrelator: mtnMessage.clientCorrelator,
              resourceUrl: mtnMessage.resourceUrl,
              status: mtnMessage.status || "sent",
              sentAt: now,
              lastEvaluatedAt: now,
              skippedReason: undefined,
            },
          },
        })

        await persistManualBillingOrder(updatedOrder)
        updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
          channel: "automation",
          event: "manual_billing.primary_sms_delivery",
          outcome: "delivered",
          detail: `Primary SMS sent via MTN (${routeMessageType}/${routingCarrier}) after WhatsApp delivery could not be completed`,
          payload: {
            reason: options.reason,
            routeMessageType,
            routingCarrier,
            routingPlan,
            provider,
            requestId: mtnMessage.requestId,
            target: mtnMessage.to,
          },
        })) ?? updatedOrder

        return { order: updatedOrder, sent: true, provider }
      }

      const africasTalkingMessage = await sendAfricasTalkingSmsMessage({
        to: target,
        message: smsMessage,
      })

      let updatedOrder = withMergedMetadata(workingOrder, {
        notifications: {
          ...(workingOrder.metadata?.notifications ?? {}),
          primarySms: {
            ...(workingOrder.metadata?.notifications?.primarySms ?? {}),
            provider,
            target: africasTalkingMessage.to,
            message: smsMessage,
            messageId: africasTalkingMessage.messageId,
            cost: africasTalkingMessage.cost,
            status: africasTalkingMessage.status || "sent",
            statusCode: africasTalkingMessage.statusCode,
            summaryMessage: africasTalkingMessage.summaryMessage,
            sentAt: now,
            lastUpdatedAt: now,
            manualShareRequired: false,
            lastFailureReason: undefined,
            retryCount,
          },
          africasTalkingFallback: {
            ...(workingOrder.metadata?.notifications?.africasTalkingFallback ?? {}),
            enabled: true,
            target: africasTalkingMessage.to,
            message: smsMessage,
            messageId: africasTalkingMessage.messageId,
            cost: africasTalkingMessage.cost,
            status: africasTalkingMessage.status || "sent",
            statusCode: africasTalkingMessage.statusCode,
            summaryMessage: africasTalkingMessage.summaryMessage,
            sentAt: now,
            lastEvaluatedAt: now,
            skippedReason: undefined,
          },
        },
      })

      await persistManualBillingOrder(updatedOrder)
      updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
        channel: "automation",
        event: "manual_billing.primary_sms_delivery",
        outcome: "delivered",
        detail: `Primary SMS sent via AfricasTalking (${routeMessageType}/${routingCarrier}) after WhatsApp delivery could not be completed`,
        payload: {
          reason: options.reason,
          routeMessageType,
          routingCarrier,
          routingPlan,
          provider,
          messageId: africasTalkingMessage.messageId,
          target: africasTalkingMessage.to,
        },
      })) ?? updatedOrder

      return { order: updatedOrder, sent: true, provider }
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : `${getSmsFallbackProviderLabel(provider)} fallback SMS failed`
      attemptErrors.push(`${getSmsFallbackProviderLabel(provider)}: ${failureReason}`)
      workingOrder = withSmsFallbackAttemptRecorded(workingOrder, provider, target, smsMessage, now, failureReason)
      workingOrder = withMergedMetadata(workingOrder, {
        notifications: {
          ...(workingOrder.metadata?.notifications ?? {}),
          primarySms: {
            ...(workingOrder.metadata?.notifications?.primarySms ?? {}),
            provider,
            target,
            message: smsMessage,
            status: "failed",
            manualShareRequired: true,
            lastFailureReason: failureReason,
            lastUpdatedAt: now,
            retryCount: Number(workingOrder.metadata?.notifications?.primarySms?.retryCount || 0) + 1,
          },
        },
      })
      await persistManualBillingOrder(workingOrder)
      workingOrder = (await recordManualOrderAuditEvent(workingOrder.id, {
        channel: "automation",
        event: getSmsFallbackProviderEvent(provider),
        outcome: "failed",
        detail: failureReason,
      })) ?? workingOrder
    }
  }

  const finalReason = [...providerIssues, ...attemptErrors].join("; ") || "All SMS delivery providers failed"
  workingOrder = withMergedMetadata(workingOrder, {
    notifications: {
      ...(workingOrder.metadata?.notifications ?? {}),
      primarySms: {
        ...(workingOrder.metadata?.notifications?.primarySms ?? {}),
        target,
        message: smsMessage,
        status: "failed",
        manualShareRequired: true,
        lastFailureReason: finalReason,
        lastUpdatedAt: now,
      },
    },
  })
  await persistManualBillingOrder(workingOrder)

  return {
    order: (await recordManualOrderAuditEvent(workingOrder.id, {
      channel: "automation",
      event: "manual_billing.primary_sms_delivery",
      outcome: "failed",
      detail: finalReason,
      payload: {
        reason: options.reason,
        routeMessageType,
        routingCarrier,
        routingPlan,
      },
    })) ?? workingOrder,
    sent: false,
    reason: finalReason,
  }
}

async function sendWhatsAppFulfillmentMessage(order: ManualBillingOrder) {
  const fulfillment = order.metadata?.fulfillment

  if (!fulfillment) {
    return order
  }

  const target = fulfillment.whatsappTarget ?? fulfillment.customerPhone ?? order.customer.customerPhone
  const message = buildCustomerFulfillmentWhatsAppMessage(order, fulfillment)

  if (!target || !message) {
    const auditedOrder = (await recordManualOrderAuditEvent(order.id, {
      channel: "whatsapp_send",
      event: "manual_billing.fulfillment",
      outcome: "skipped",
      detail: "WhatsApp fulfillment payload is incomplete",
      payload: {
        deliveryMethod: fulfillment.deliveryMethod,
      }
    })) ?? order

    return (await sendManualBillingSmsDelivery(auditedOrder, {
      reason: "WhatsApp fulfillment payload is incomplete",
    })).order
  }

  const whatsappHref = buildWhatsAppHref(target, message)
  let updatedOrder = withMergedMetadata(order, {
    fulfillment: {
      ...fulfillment,
      whatsappTarget: normalizeManualBillingPhone(target),
      whatsappHref,
    },
  })

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
    updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
      channel: "whatsapp_send",
      event: "manual_billing.fulfillment",
      outcome: "processed",
      detail: "WhatsApp delivery link generated; Twilio WhatsApp credentials are not configured",
      payload: {
        whatsappHref,
        deliveryMethod: fulfillment.deliveryMethod,
      }
    })) ?? updatedOrder

    return (await sendManualBillingSmsDelivery(updatedOrder, {
      reason: "Twilio WhatsApp credentials are not configured",
    })).order
  }

  try {
    const twilioMessage = await sendTwilioWhatsAppMessage({
      to: target,
      body: message,
      statusCallback: getTwilioWhatsAppStatusCallbackUrl()
    })

    updatedOrder = withMergedMetadata(updatedOrder, {
      fulfillment: {
        ...updatedOrder.metadata?.fulfillment,
        whatsappMessageSid: twilioMessage.sid,
        whatsappHref,
      },
      notifications: {
        ...(updatedOrder.metadata?.notifications ?? {}),
        whatsapp: {
          ...(updatedOrder.metadata?.notifications?.whatsapp ?? {}),
          messageSid: twilioMessage.sid,
          status: "sent",
          statusRecordedAt: new Date().toISOString(),
        },
      },
    })

    updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
      channel: "whatsapp_send",
      event: "manual_billing.fulfillment",
      outcome: "delivered",
      detail: "Fulfillment details sent via Twilio WhatsApp",
      payload: {
        messageSid: twilioMessage.sid,
        deliveryMethod: fulfillment.deliveryMethod,
        whatsappHref,
      }
    })) ?? updatedOrder

    return updatedOrder
  } catch (error) {
    updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
      channel: "whatsapp_send",
      event: "manual_billing.fulfillment",
      outcome: "failed",
      detail: error instanceof Error ? error.message : "Twilio WhatsApp delivery failed",
      payload: {
        whatsappHref,
        deliveryMethod: fulfillment.deliveryMethod,
      }
    })) ?? updatedOrder

    return (await sendManualBillingSmsDelivery(updatedOrder, {
      reason: error instanceof Error ? error.message : "Twilio WhatsApp delivery failed",
    })).order
  }
}

async function hydrateManualOrderWithAuditEvents(order: ManualBillingOrder) {
  const metadataEvents = getManualBillingAuditTrail(order)
  const persistedEvents = await listManualBillingAuditEvents(order.id)

  if (persistedEvents.length === 0) {
    return order
  }

  const mergedEvents = [...metadataEvents, ...persistedEvents].reduce<ManualBillingAuditEvent[]>((events, event) => {
    if (events.some((candidate) => candidate.id === event.id)) {
      return events
    }

    events.push(event)
    return events
  }, []).sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))

  return patchManualBillingOrder(order, {
    metadata: {
      ...(order.metadata ?? {}),
      auditTrail: mergedEvents
    }
  })
}

async function getPersistedManualOrder(orderId: string) {
  const order = getManualBillingOrder(orderId) ?? (await fetchManualBillingOrder(orderId))

  if (!order) {
    return null
  }

  return hydrateManualOrderWithAuditEvents(order)
}

async function getPersistedManualOrders() {
  const inMemory = listManualBillingOrders()
  if (inMemory.length > 0) {
    return Promise.all(inMemory.map(hydrateManualOrderWithAuditEvents))
  }

  const orders = await listManualBillingOrdersFromSupabase()
  return Promise.all(orders.map(hydrateManualOrderWithAuditEvents))
}

export async function recordManualOrderAuditEvent(
  orderId: string,
  input: {
    channel: ManualBillingAuditChannel
    event: string
    outcome: ManualBillingAuditOutcome
    detail?: string
    payload?: Record<string, unknown>
  }
) {
  const order = await getPersistedManualOrder(orderId)

  if (!order) {
    return null
  }

  const updatedOrder = appendManualBillingAuditEvent(order, {
    id: crypto.randomUUID(),
    channel: input.channel,
    event: input.event,
    outcome: input.outcome,
    detail: input.detail,
    payload: input.payload,
    recordedAt: new Date().toISOString()
  })

  await persistManualBillingOrder(updatedOrder)
  await persistManualBillingAuditEvent(updatedOrder, getManualBillingAuditTrail(updatedOrder).at(-1)!)
  return updatedOrder
}

async function applyOperatorAction(
  order: ManualBillingOrder,
  action: TelegramButtonAction,
  source: OperatorActionSource,
  adminExecutionNotes?: string,
  fulfillmentInput?: ManualFulfillmentInput,
) {
  let updatedOrder = order

  if (action === "start" && order.status === "paid") {
    updatedOrder = transitionManualBillingOrder(
      order,
      "operator_started",
      {
        adminExecutionNotes: adminExecutionNotes ?? order.adminExecutionNotes
      },
      getOperatorActionTransitionNote(action, source)
    )
  }

  if (action === "confirm" && order.status === "operator_started") {
    updatedOrder = transitionManualBillingOrder(
      order,
      "operator_confirmed",
      {
        adminExecutionNotes: adminExecutionNotes ?? order.adminExecutionNotes
      },
      getOperatorActionTransitionNote(action, source)
    )
  }

  if (action === "complete" && order.status === "operator_confirmed") {
    updatedOrder = transitionManualBillingOrder(
      order,
      "completed",
      {
        adminExecutionNotes: adminExecutionNotes ?? order.adminExecutionNotes
      },
      getOperatorActionTransitionNote(action, source)
    )
  }

  if (updatedOrder !== order) {
    const deliveredAt = updatedOrder.status === "completed" ? new Date().toISOString() : undefined
    const fulfillmentPatch = buildFulfillmentPatch(updatedOrder, source, fulfillmentInput, deliveredAt)

    if (fulfillmentPatch) {
      updatedOrder = withMergedMetadata(updatedOrder, {
        fulfillment: fulfillmentPatch,
      })
    }
  }

  if (updatedOrder !== order) {
    await persistManualBillingOrder(updatedOrder)
    if (updatedOrder.status === "completed") {
      updatedOrder = await sendWhatsAppFulfillmentMessage(updatedOrder)
      await persistManualBillingOrder(updatedOrder)
    }
    const telegramResult = await sendTelegramMessage(updatedOrder, updatedOrder.status)
    updatedOrder = telegramResult.order
  }

  return updatedOrder
}

async function autoCompleteManualOrderAfterPayment(orderId: string) {
  let order: ManualBillingOrder | null = await getManualOrder(orderId)

  if (!order || !shouldAutoCompleteManualOrder(order) || order.status !== "paid") {
    return order
  }

  for (const action of ["start", "confirm", "complete"] as const) {
    order = await applyOperatorAction(
      order,
      action,
      "automation",
      "Automatic operator completion enabled for manual billing"
    )
  }

  return order
}

async function sendTelegramMessage(order: ManualBillingOrder, stage: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  let auditOrder = await recordManualOrderAuditEvent(order.id, {
    channel: "telegram_send",
    event: `manual_billing.${stage}`,
    outcome: "attempted",
    payload: {
      stage
    }
  })

  if (auditOrder) {
    order = auditOrder
  }

  if (!botToken || !chatId) {
    auditOrder = await recordManualOrderAuditEvent(order.id, {
      channel: "telegram_send",
      event: `manual_billing.${stage}`,
      outcome: "skipped",
      detail: "Telegram bot token or chat id is not configured",
      payload: {
        stage
      }
    })

    return {
      order: auditOrder ?? order,
      messageId: null
    }
  }

  const adminUrl = `${getBaseUrl()}/internal/manual-billing`
  const fulfillment = order.metadata?.fulfillment
  const text = [
    `Manual billing: ${order.service}`,
    `Order: ${order.id}`,
    `Stage: ${stage}`,
    `Account: ${order.accountReference}`,
    order.packageLabel ? `Package: ${order.packageLabel}` : null,
    order.quotedAmount ? `Amount: ${order.quotedAmount.toLocaleString()} ${order.currency}` : null,
    `Recipient: ${order.customer.recipientName}`,
    order.customer.customerPhone ? `Phone: ${order.customer.customerPhone}` : null,
    fulfillment?.token ? `Token: ${fulfillment.token}` : null,
    fulfillment?.units ? `Units: ${fulfillment.units}` : null,
    fulfillment?.receiptReference ? `Reference: ${fulfillment.receiptReference}` : null,
    fulfillment?.note ? `Note: ${fulfillment.note}` : null,
    `Admin: ${adminUrl}`
  ].filter(Boolean).join("\n")

  const keyboard = {
    inline_keyboard: [[
      { text: "Start", callback_data: `manual:${order.id}:start` },
      { text: "Confirm", callback_data: `manual:${order.id}:confirm` },
      { text: "Complete", callback_data: `manual:${order.id}:complete` }
    ]]
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: keyboard
    })
  })

  if (!response.ok) {
    const responseText = await response.text()
    auditOrder = await recordManualOrderAuditEvent(order.id, {
      channel: "telegram_send",
      event: `manual_billing.${stage}`,
      outcome: "failed",
      detail: `Telegram API returned ${response.status}`,
      payload: {
        stage,
        status: response.status,
        responseText: responseText.slice(0, 300)
      }
    })

    return {
      order: auditOrder ?? order,
      messageId: null
    }
  }

  const payload = await response.json()
  const messageId = String(payload.result?.message_id || "") || null

  auditOrder = await recordManualOrderAuditEvent(order.id, {
    channel: "telegram_send",
    event: `manual_billing.${stage}`,
    outcome: "delivered",
    payload: {
      stage,
      messageId
    }
  })

  return {
    order: auditOrder ?? order,
    messageId
  }
}

function getCanalPlusPackage(packageCode?: string) {
  return CANAL_PLUS_PACKAGES.find((pkg) => pkg.code === packageCode)
}

function getCiePrepaidAmountOption(packageCode?: string) {
  return CIE_PREPAID_AMOUNT_OPTIONS.find((option) => option.code === packageCode)
}

export function listCanalPlusPackages() {
  return [...CANAL_PLUS_PACKAGES]
}

export function listCiePrepaidAmountOptions() {
  return [...CIE_PREPAID_AMOUNT_OPTIONS]
}

export async function createManualOrder(input: CreateManualOrderInput) {
  if (input.service === "canal-plus" && !getCanalPlusPackage(input.packageCode)) {
    throw new Error("A valid Canal+ package is required")
  }

  if (input.service === "cie-prepaid" && !getCiePrepaidAmountOption(input.packageCode)) {
    throw new Error("A valid CIE prepaid amount is required")
  }

  const validated = validateManualBillingDraft({
    service: input.service,
    accountReference: input.accountReference,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    recipientName: input.recipientName,
  })

  if (validated.errors.length > 0) {
    throw new Error(validated.errors.join(". "))
  }

  const existingOrders = await getPersistedManualOrders()
  const resumableOrder = findResumableManualOrder(existingOrders, {
    service: input.service,
    accountReference: validated.normalizedAccountReference,
    customerEmail: validated.normalizedEmail,
    recipientName: validated.normalizedRecipientName,
  })

  if (resumableOrder) {
    await recordManualOrderAuditEvent(resumableOrder.id, {
      channel: "system",
      event: "manual_billing.duplicate_resumed",
      outcome: "processed",
      detail: "Matched an existing open order for the same service, account reference, and customer.",
      payload: {
        service: input.service,
        normalizedAccountReference: validated.normalizedAccountReference,
      },
    })

    const reloadedResumableOrder = await getPersistedManualOrder(resumableOrder.id)
    if (!reloadedResumableOrder) {
      return resumableOrder
    }

    const enrichedResumableOrder = withManualBillingOperationalInsights(reloadedResumableOrder, existingOrders)

    return {
      ...enrichedResumableOrder,
      metadata: {
        ...(enrichedResumableOrder.metadata ?? {}),
        normalizedAccountReference: validated.normalizedAccountReference,
        insights: {
          ...(enrichedResumableOrder.metadata?.insights ?? {}),
          resumedExistingOrder: true,
        },
      },
    }
  }

  const order = createManualBillingOrder({
    id: createOrderId(input.service),
    traceId: createTraceId(),
    service: input.service,
    countryCode: "CI",
    accountReference: validated.normalizedAccountReference,
    packageCode: input.packageCode,
    packageLabel: input.packageLabel,
    quotedAmount: undefined,
    currency: "XOF",
    customer: {
      customerName: validated.normalizedCustomerName,
      customerEmail: validated.normalizedEmail,
      customerPhone: validated.normalizedPhone,
      recipientName: validated.normalizedRecipientName
    },
    metadata: {
      ...(input.metadata ?? {}),
      normalizedAccountReference: validated.normalizedAccountReference,
    }
  })

  let updatedOrder = order

  if (input.service === "canal-plus" || input.service === "cie-prepaid") {
    const selectedPackage = input.service === "canal-plus"
      ? getCanalPlusPackage(input.packageCode)
      : getCiePrepaidAmountOption(input.packageCode)
    const pricingSummary = await quoteManualBillingAmount(input.service, selectedPackage!.amount, {
      packageCode: selectedPackage!.code
    })

    updatedOrder = transitionManualBillingOrder(
      order,
      "quote_ready",
      {
        quotedAmount: pricingSummary.customerPrice,
          adminQuoteNotes: input.service === "canal-plus"
            ? "Fixed Canal+ package priced by AfriSendIQ profit engine"
            : "Fixed CIE prepaid amount priced by AfriSendIQ profit engine",
        pricingSummary,
        metadata: {
          ...(order.metadata ?? {}),
          manualPricing: pricingSummary
        }
      },
        input.service === "canal-plus" ? "Canal+ package selected" : "CIE prepaid amount selected"
    )
  } else {
    const lookupResult = await lookupManualBillAmount({
      service: input.service,
      accountReference: validated.normalizedAccountReference,
      existingOrders,
    })

    updatedOrder = withMergedMetadata(updatedOrder, {
      lookup: lookupResult,
    })

    if (lookupResult.status === "found" && typeof lookupResult.amount === "number" && lookupResult.amount > 0) {
      const pricingSummary = await quoteManualBillingAmount(input.service, lookupResult.amount)

      updatedOrder = transitionManualBillingOrder(
        updatedOrder,
        "quote_ready",
        {
          quotedAmount: pricingSummary.customerPrice,
          adminQuoteNotes: lookupResult.detail || "Bill amount auto-fetched before quote creation.",
          pricingSummary,
          metadata: {
            ...(updatedOrder.metadata ?? {}),
            manualPricing: pricingSummary,
            lookup: lookupResult,
          }
        },
        `Automatic bill lookup (${lookupResult.source})`
      )
    }
  }

  updatedOrder = withManualBillingOperationalInsights(updatedOrder, [...existingOrders, updatedOrder])

  await persistManualBillingOrder(updatedOrder)

  updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
    channel: "system",
    event: "manual_billing.order_created",
    outcome: "processed",
    payload: {
      service: updatedOrder.service,
      status: updatedOrder.status
    }
  })) ?? updatedOrder

  const telegramResult = await sendTelegramMessage(updatedOrder, updatedOrder.status)
  updatedOrder = telegramResult.order
  const telegramMessageId = telegramResult.messageId

  if (telegramMessageId) {
    updatedOrder = patchManualBillingOrder(updatedOrder, { telegramMessageId })
    await persistManualBillingOrder(updatedOrder)
  }

  return updatedOrder
}

export async function getManualOrder(orderId: string) {
  const order = await getPersistedManualOrder(orderId)

  if (!order) {
    return null
  }

  const allOrders = await getPersistedManualOrders()
  return withManualBillingOperationalInsights(order, allOrders)
}

export async function getAllManualOrders() {
  const orders = await getPersistedManualOrders()
  return orders.map((order) => withManualBillingOperationalInsights(order, orders))
}

export async function setManualQuote(input: AdminQuoteInput) {
  const order = await getPersistedManualOrder(input.orderId)

  if (!order) {
    throw new Error("Manual billing order not found")
  }

  const pricingSummary = await quoteManualBillingAmount(order.service, input.quotedAmount, {
    packageCode: order.packageCode
  })

  const quoteReady = transitionManualBillingOrder(
    order,
    "quote_ready",
    {
      quotedAmount: pricingSummary.customerPrice,
      adminQuoteNotes: input.adminQuoteNotes,
      pricingSummary,
      metadata: {
        ...(order.metadata ?? {}),
        manualPricing: pricingSummary
      }
    },
    "Admin added quoted bill amount"
  )

  await persistManualBillingOrder(quoteReady)
  await sendTelegramMessage(quoteReady, "quote_ready")

  return quoteReady
}

export async function createManualCheckoutSession(orderId: string) {
  const order = await getPersistedManualOrder(orderId)

  if (!order) {
    throw new Error("Manual billing order not found")
  }

  if (order.status !== "quote_ready") {
    throw new Error(`Cannot create payment session for order in ${order.status} status`)
  }

  if (!order.quotedAmount || order.quotedAmount <= 0) {
    throw new Error("Manual billing order has no quoted amount")
  }

  const session = await stripePaymentService.createCheckoutSession({
    orderId: order.id,
    amount: order.quotedAmount,
    currency: order.currency,
    customerEmail: order.customer.customerEmail,
    successUrl: `${getBaseUrl()}${getManualBillingCustomerPath(order.service)}?orderId=${order.id}&payment=success`,
    cancelUrl: `${getBaseUrl()}${getManualBillingCustomerPath(order.service)}?orderId=${order.id}&payment=cancelled`,
    metadata: {
      orderType: "manual_billing",
      service: order.service,
    },
  })

  const updatedOrder = transitionManualBillingOrder(
    order,
    "payment_pending",
    {
      paymentSessionId: session.paymentId,
      stripePaymentStatus: "pending"
    },
    "Stripe checkout created"
  )

  await persistManualBillingOrder(updatedOrder)
  return { order: updatedOrder, checkoutUrl: session.checkoutUrl }
}

export async function markManualOrderPaid(orderId: string, paymentSessionId?: string) {
  const order = await getPersistedManualOrder(orderId)

  if (!order) {
    throw new Error("Manual billing order not found")
  }

  if (order.status !== "payment_pending") {
    return order
  }

  const updatedOrder = transitionManualBillingOrder(
    order,
    "paid",
    {
      paymentSessionId: paymentSessionId ?? order.paymentSessionId,
      stripePaymentStatus: "paid"
    },
    "Stripe payment confirmed"
  )

  await persistManualBillingOrder(updatedOrder)
  const telegramResult = await sendTelegramMessage(updatedOrder, "paid")
  const paidOrder = telegramResult.order

  if (shouldAutoCompleteManualOrder(paidOrder)) {
    await recordManualOrderAuditEvent(paidOrder.id, {
      channel: "automation",
      event: "manual_billing.auto_complete_requested",
      outcome: "processed",
      payload: {
        service: paidOrder.service
      }
    })

    try {
      const completedOrder = await autoCompleteManualOrderAfterPayment(orderId)
      if (completedOrder) {
        return completedOrder
      }
    } catch (error) {
      console.error("[manual-billing] Automatic operator completion failed:", error)
    }
  }

  return paidOrder
}

export async function advanceManualOrderOperatorState(
  orderId: string,
  action: TelegramButtonAction,
  options: {
    source?: OperatorActionSource
    adminExecutionNotes?: string
    fulfillment?: ManualFulfillmentInput
  } = {}
) {
  const order = await getPersistedManualOrder(orderId)

  if (!order) {
    throw new Error("Manual billing order not found")
  }

  return applyOperatorAction(order, action, options.source ?? "telegram", options.adminExecutionNotes, options.fulfillment)
}

export async function handleTelegramAction(orderId: string, action: TelegramButtonAction) {
  return advanceManualOrderOperatorState(orderId, action, { source: "telegram" })
}

export async function failManualOrder(input: AdminFailureInput) {
  const order = await getPersistedManualOrder(input.orderId)

  if (!order) {
    throw new Error("Manual billing order not found")
  }

  const failedOrder = transitionManualBillingOrder(
    order,
    "failed",
    {
      failureReason: input.failureReason,
      adminExecutionNotes: input.adminExecutionNotes
    },
    "Admin marked order failed"
  )

  await persistManualBillingOrder(failedOrder)
  await sendTelegramMessage(failedOrder, "failed")
  return failedOrder
}

export function presentManualOrder(order: ManualBillingOrder) {
  return toManualOrderResponse(order)
}

export function presentManualOrders(orders: ManualBillingOrder[]) {
  return orders.map(toManualOrderResponse)
}

function getAuditOutcomeForWhatsAppStatus(status: string): ManualBillingAuditOutcome {
  if (status === "read" || status === "delivered") {
    return "delivered"
  }

  if (status === "failed" || status === "undelivered") {
    return "failed"
  }

  return "processed"
}

function normalizeTwilioWhatsAppStatus(value?: string) {
  return String(value || "").trim().toLowerCase() || "unknown"
}

function normalizeOrangeDeliveryStatus(value?: string) {
  return String(value || "").trim() || "unknown"
}

function normalizeAfricasTalkingDeliveryStatus(value?: string) {
  return String(value || "").trim() || "unknown"
}

function getAuditOutcomeForSmsDeliveryStatus(status: string): ManualBillingAuditOutcome {
  if (status === "DeliveredToTerminal") {
    return "delivered"
  }

  if (status === "DeliveryImpossible") {
    return "failed"
  }

  return "processed"
}

function getAuditOutcomeForAfricasTalkingDeliveryStatus(status: string): ManualBillingAuditOutcome {
  if (status === "Success") {
    return "delivered"
  }

  if (status === "Rejected" || status === "Failed" || status === "AbsentSubscriber" || status === "Expired") {
    return "failed"
  }

  return "processed"
}

export async function recordManualOrderWhatsAppStatus(input: {
  messageSid: string
  status?: string
  payload?: Record<string, unknown>
}) {
  const orders = await getPersistedManualOrders()
  const order = orders.find((candidate) => {
    const fulfillmentSid = candidate.metadata?.fulfillment?.whatsappMessageSid
    const notificationSid = candidate.metadata?.notifications?.whatsapp?.messageSid
    return fulfillmentSid === input.messageSid || notificationSid === input.messageSid
  })

  if (!order) {
    return null
  }

  const status = normalizeTwilioWhatsAppStatus(input.status)
  const recordedAt = new Date().toISOString()
  const existingWhatsAppNotification = order.metadata?.notifications?.whatsapp ?? {}

  let updatedOrder = withMergedMetadata(order, {
    notifications: {
      ...(order.metadata?.notifications ?? {}),
      whatsapp: {
        ...existingWhatsAppNotification,
        messageSid: input.messageSid,
        status,
        statusRecordedAt: recordedAt,
        deliveredAt: status === "delivered" || status === "read"
          ? existingWhatsAppNotification.deliveredAt ?? recordedAt
          : existingWhatsAppNotification.deliveredAt,
        readAt: status === "read" ? recordedAt : existingWhatsAppNotification.readAt,
        callbackPayload: input.payload,
      },
    },
  })

  await persistManualBillingOrder(updatedOrder)
  updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
    channel: "automation",
    event: "manual_billing.whatsapp_status",
    outcome: getAuditOutcomeForWhatsAppStatus(status),
    detail: `Twilio WhatsApp status updated to ${status}`,
    payload: {
      messageSid: input.messageSid,
      status,
    },
  })) ?? updatedOrder

  return updatedOrder
}

export async function recordManualOrderOrangeFallbackStatus(input: {
  resourceId: string
  status?: string
  payload?: Record<string, unknown>
}) {
  const orders = await getPersistedManualOrders()
  const order = orders.find((candidate) => candidate.metadata?.notifications?.orangeFallback?.resourceId === input.resourceId)

  if (!order) {
    return null
  }

  const status = normalizeOrangeDeliveryStatus(input.status)
  const recordedAt = new Date().toISOString()
  const existingOrangeFallback = order.metadata?.notifications?.orangeFallback ?? {}

  let updatedOrder = withMergedMetadata(order, {
    notifications: {
      ...(order.metadata?.notifications ?? {}),
      primarySms: existingOrangeFallback.resourceId === input.resourceId || order.metadata?.notifications?.primarySms?.resourceId === input.resourceId
        ? {
            ...(order.metadata?.notifications?.primarySms ?? {}),
            provider: "orange",
            resourceId: input.resourceId,
            status,
            deliveredAt: status === "DeliveredToTerminal"
              ? order.metadata?.notifications?.primarySms?.deliveredAt ?? recordedAt
              : order.metadata?.notifications?.primarySms?.deliveredAt,
            lastUpdatedAt: recordedAt,
          }
        : order.metadata?.notifications?.primarySms,
      orangeFallback: {
        ...existingOrangeFallback,
        resourceId: input.resourceId,
        status,
        callbackPayload: input.payload,
        lastEvaluatedAt: recordedAt,
      },
    },
  })

  await persistManualBillingOrder(updatedOrder)
  updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
    channel: "automation",
    event: "manual_billing.orange_fallback_status",
    outcome: getAuditOutcomeForSmsDeliveryStatus(status),
    detail: `Orange delivery receipt updated to ${status}`,
    payload: {
      resourceId: input.resourceId,
      status,
    },
  })) ?? updatedOrder

  return updatedOrder
}

export async function recordManualOrderTwilioSmsFallbackStatus(input: {
  messageSid: string
  status?: string
  payload?: Record<string, unknown>
}) {
  const orders = await getPersistedManualOrders()
  const order = orders.find((candidate) => candidate.metadata?.notifications?.twilioSmsFallback?.messageSid === input.messageSid)

  if (!order) {
    return null
  }

  const status = normalizeTwilioWhatsAppStatus(input.status)
  const recordedAt = new Date().toISOString()
  const existingTwilioFallback = order.metadata?.notifications?.twilioSmsFallback ?? {}

  let updatedOrder = withMergedMetadata(order, {
    notifications: {
      ...(order.metadata?.notifications ?? {}),
      primarySms: existingTwilioFallback.messageSid === input.messageSid || order.metadata?.notifications?.primarySms?.messageSid === input.messageSid
        ? {
            ...(order.metadata?.notifications?.primarySms ?? {}),
            provider: "twilio",
            messageSid: input.messageSid,
            status,
            deliveredAt: (status === "delivered" || status === "read")
              ? order.metadata?.notifications?.primarySms?.deliveredAt ?? recordedAt
              : order.metadata?.notifications?.primarySms?.deliveredAt,
            lastUpdatedAt: recordedAt,
          }
        : order.metadata?.notifications?.primarySms,
      twilioSmsFallback: {
        ...existingTwilioFallback,
        messageSid: input.messageSid,
        status,
        callbackPayload: input.payload,
        lastEvaluatedAt: recordedAt,
      },
    },
  })

  await persistManualBillingOrder(updatedOrder)
  updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
    channel: "automation",
    event: "manual_billing.twilio_sms_fallback_status",
    outcome: getAuditOutcomeForWhatsAppStatus(status),
    detail: `Twilio SMS delivery status updated to ${status}`,
    payload: {
      messageSid: input.messageSid,
      status,
    },
  })) ?? updatedOrder

  return updatedOrder
}

export async function recordManualOrderMtnFallbackStatus(input: {
  requestId?: string
  clientCorrelator?: string
  transactionId?: string
  status?: string
  payload?: Record<string, unknown>
}) {
  const orders = await getPersistedManualOrders()
  const order = orders.find((candidate) => {
    const notification = candidate.metadata?.notifications?.mtnFallback
    return Boolean(
      (input.requestId && notification?.requestId === input.requestId)
      || (input.clientCorrelator && notification?.clientCorrelator === input.clientCorrelator)
      || (input.transactionId && notification?.transactionId === input.transactionId)
    )
  })

  if (!order) {
    return null
  }

  const status = normalizeOrangeDeliveryStatus(input.status)
  const recordedAt = new Date().toISOString()
  const existingMtnFallback = order.metadata?.notifications?.mtnFallback ?? {}

  let updatedOrder = withMergedMetadata(order, {
    notifications: {
      ...(order.metadata?.notifications ?? {}),
      primarySms: existingMtnFallback.requestId === input.requestId
        || existingMtnFallback.clientCorrelator === input.clientCorrelator
        || existingMtnFallback.transactionId === input.transactionId
        || order.metadata?.notifications?.primarySms?.requestId === input.requestId
        || order.metadata?.notifications?.primarySms?.clientCorrelator === input.clientCorrelator
        || order.metadata?.notifications?.primarySms?.transactionId === input.transactionId
        ? {
            ...(order.metadata?.notifications?.primarySms ?? {}),
            provider: "mtn",
            requestId: input.requestId ?? order.metadata?.notifications?.primarySms?.requestId,
            clientCorrelator: input.clientCorrelator ?? order.metadata?.notifications?.primarySms?.clientCorrelator,
            transactionId: input.transactionId ?? order.metadata?.notifications?.primarySms?.transactionId,
            status,
            deliveredAt: status === "DeliveredToTerminal"
              ? order.metadata?.notifications?.primarySms?.deliveredAt ?? recordedAt
              : order.metadata?.notifications?.primarySms?.deliveredAt,
            lastUpdatedAt: recordedAt,
          }
        : order.metadata?.notifications?.primarySms,
      mtnFallback: {
        ...existingMtnFallback,
        requestId: input.requestId ?? existingMtnFallback.requestId,
        clientCorrelator: input.clientCorrelator ?? existingMtnFallback.clientCorrelator,
        transactionId: input.transactionId ?? existingMtnFallback.transactionId,
        status,
        callbackPayload: input.payload,
        lastEvaluatedAt: recordedAt,
      },
    },
  })

  await persistManualBillingOrder(updatedOrder)
  updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
    channel: "automation",
    event: "manual_billing.mtn_fallback_status",
    outcome: getAuditOutcomeForSmsDeliveryStatus(status),
    detail: `MTN delivery receipt updated to ${status}`,
    payload: {
      requestId: input.requestId,
      clientCorrelator: input.clientCorrelator,
      transactionId: input.transactionId,
      status,
    },
  })) ?? updatedOrder

  return updatedOrder
}

export async function recordManualOrderAfricasTalkingFallbackStatus(input: {
  messageId: string
  status?: string
  payload?: Record<string, unknown>
}) {
  const orders = await getPersistedManualOrders()
  const order = orders.find((candidate) => candidate.metadata?.notifications?.africasTalkingFallback?.messageId === input.messageId)

  if (!order) {
    return null
  }

  const status = normalizeAfricasTalkingDeliveryStatus(input.status)
  const recordedAt = new Date().toISOString()
  const existingAfricasTalkingFallback = order.metadata?.notifications?.africasTalkingFallback ?? {}
  const payloadPhoneNumber = typeof input.payload?.phoneNumber === "string" ? input.payload.phoneNumber : undefined
  const payloadFailureReason = typeof input.payload?.failureReason === "string" ? input.payload.failureReason : undefined

  let updatedOrder = withMergedMetadata(order, {
    notifications: {
      ...(order.metadata?.notifications ?? {}),
      primarySms: existingAfricasTalkingFallback.messageId === input.messageId || order.metadata?.notifications?.primarySms?.messageId === input.messageId
        ? {
            ...(order.metadata?.notifications?.primarySms ?? {}),
            provider: "africasTalking",
            messageId: input.messageId,
            status,
            summaryMessage: payloadFailureReason ?? order.metadata?.notifications?.primarySms?.summaryMessage,
            deliveredAt: status === "Success"
              ? order.metadata?.notifications?.primarySms?.deliveredAt ?? recordedAt
              : order.metadata?.notifications?.primarySms?.deliveredAt,
            lastUpdatedAt: recordedAt,
          }
        : order.metadata?.notifications?.primarySms,
      africasTalkingFallback: {
        ...existingAfricasTalkingFallback,
        messageId: input.messageId,
        target: payloadPhoneNumber ?? existingAfricasTalkingFallback.target,
        status,
        summaryMessage: payloadFailureReason ?? existingAfricasTalkingFallback.summaryMessage,
        callbackPayload: input.payload,
        lastEvaluatedAt: recordedAt,
      },
    },
  })

  await persistManualBillingOrder(updatedOrder)
  updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
    channel: "automation",
    event: "manual_billing.africas_talking_fallback_status",
    outcome: getAuditOutcomeForAfricasTalkingDeliveryStatus(status),
    detail: `AfricasTalking delivery report updated to ${status}`,
    payload: {
      messageId: input.messageId,
      status,
      phoneNumber: payloadPhoneNumber,
      failureReason: payloadFailureReason,
    },
  })) ?? updatedOrder

  return updatedOrder
}

function getFallbackMessagePayload(order: ManualBillingOrder) {
  const fulfillment = order.metadata?.fulfillment
  const message = fulfillment ? buildCustomerFulfillmentSmsMessage(order, fulfillment) : null
  const target = fulfillment?.customerPhone

  if (!target || !message) {
    return null
  }

  return { target, message }
}

export async function runManualBillingSmsFallbackEvaluation(options: {
  dryRun?: boolean
  limit?: number
  now?: Date
  settingsOverride?: ManualBillingFallbackSettingsOverride
} = {}) {
  const baseSettings = await getManualBillingAlertSettings()
  const settings = {
    ...baseSettings,
    ...(options.settingsOverride ?? {}),
    routingPolicy: options.settingsOverride?.routingPolicy ?? baseSettings.routingPolicy ?? getDefaultManualBillingSmsRoutingPolicy(),
  }
  const now = options.now ?? new Date()
  const orders = await getPersistedManualOrders()
  const candidates = orders
    .filter((order) => order.status === "completed")
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))

  const results: Array<{
    orderId: string
    eligible: boolean
    action: "skipped" | "sent"
    reason: string
    evaluateAfter?: string
    routeMessageType?: "confirmation" | "token" | "receipt" | "retry"
    routingCarrier?: "mtn-ci" | "orange-ci" | "moov-ci" | "unknown-ci"
      routingPlan?: ManualBillingSmsProvider[]
      availableProviders?: ManualBillingSmsProvider[]
      provider?: ManualBillingSmsProvider
    messageSid?: string
    resourceId?: string
    requestId?: string
    messageId?: string
    cost?: string
  }> = []

  const limit = typeof options.limit === "number" && options.limit > 0 ? options.limit : Number.POSITIVE_INFINITY

  for (const order of candidates) {
    if (results.filter((result) => result.action === "sent").length >= limit) {
      break
    }

    const twilioDecision = getTwilioSmsFallbackDecision(order, settings, now)
    const orangeDecision = getOrangeFallbackDecision(order, settings, now)
    const mtnDecision = getMtnFallbackDecision(order, settings, now)
    const africasTalkingDecision = getAfricasTalkingFallbackDecision(order, settings, now)
    const tpeCloudDecision = getTpeCloudFallbackDecision(order, settings, now)
    const providerDecisionMap: Record<ManualBillingSmsProvider, typeof twilioDecision> = {
      tpeCloud: tpeCloudDecision,
      twilio: twilioDecision,
      orange: orangeDecision,
      mtn: mtnDecision,
      africasTalking: africasTalkingDecision,
    }
    const eligible = Object.values(providerDecisionMap).some((decision) => decision.eligible)
    const evaluateAfter = twilioDecision.evaluateAfter ?? orangeDecision.evaluateAfter ?? mtnDecision.evaluateAfter ?? africasTalkingDecision.evaluateAfter ?? tpeCloudDecision.evaluateAfter

    if (!eligible) {
      results.push({
        orderId: order.id,
        eligible: false,
        action: "skipped",
        reason: [twilioDecision.reason, orangeDecision.reason, mtnDecision.reason, africasTalkingDecision.reason, tpeCloudDecision.reason].filter((value, index, all) => value && all.indexOf(value) === index).join("; "),
        evaluateAfter,
      })
      continue
    }

    const fallbackPayload = getFallbackMessagePayload(order)

    if (!fallbackPayload) {
      results.push({
        orderId: order.id,
        eligible: false,
        action: "skipped",
        reason: "Fallback SMS payload is incomplete",
        evaluateAfter,
      })
      continue
    }

    const providerPlan: ManualBillingSmsProvider[] = []
    const providerIssues: string[] = []
    const routingCarrier = detectManualBillingSmsCarrier(fallbackPayload.target)
    const routeMessageType = getManualBillingSmsRouteMessageType(order)
    const routingPlan = settings.routingPolicy[routeMessageType][routingCarrier]

    for (const provider of routingPlan) {
      if (!providerDecisionMap[provider].eligible) {
        continue
      }

      if (isSmsFallbackProviderConfigured(provider)) {
        providerPlan.push(provider)
      } else {
        providerIssues.push(`${getSmsFallbackProviderLabel(provider)} SMS is not configured`)
      }
    }

    if (options.dryRun) {
      results.push({
        orderId: order.id,
        eligible: true,
        action: "skipped",
        provider: providerPlan[0],
        routeMessageType,
        routingCarrier,
        routingPlan,
        availableProviders: providerPlan,
        reason: providerPlan[0]
          ? `${routeMessageType} route for ${routingCarrier}: ${routingPlan.join(" -> ")}. First eligible provider ${getSmsFallbackProviderLabel(providerPlan[0])}`
          : providerIssues.join("; ") || "No configured SMS fallback provider is available",
        evaluateAfter,
      })
      continue
    }

    const attemptErrors: string[] = []
    let sent = false
    let workingOrder = order

    for (const provider of providerPlan) {
      try {
        if (provider === "tpeCloud") {
          const tpeCloudMessage = await sendTpeCloudSmsMessage({
            to: fallbackPayload.target,
            message: fallbackPayload.message,
          })

          let updatedOrder = withMergedMetadata(workingOrder, {
            notifications: {
              ...(workingOrder.metadata?.notifications ?? {}),
              tpeCloudFallback: {
                ...(workingOrder.metadata?.notifications?.tpeCloudFallback ?? {}),
                enabled: true,
                target: tpeCloudMessage.to,
                message: fallbackPayload.message,
                messageId: tpeCloudMessage.messageId,
                status: tpeCloudMessage.status || "sent",
                sentAt: now.toISOString(),
                lastEvaluatedAt: now.toISOString(),
                skippedReason: undefined,
              },
            },
          })

          await persistManualBillingOrder(updatedOrder)
          updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
            channel: "automation",
            event: "manual_billing.tpecloud_fallback_sms",
            outcome: "delivered",
            detail: `TPECloud SMS sent via ${routeMessageType}/${routingCarrier} routing policy`,
            payload: {
              messageId: tpeCloudMessage.messageId,
              status: tpeCloudMessage.status,
              summaryMessage: tpeCloudMessage.summaryMessage,
              target: tpeCloudMessage.to,
              from: tpeCloudMessage.from,
              senderId: tpeCloudMessage.senderId,
            },
          })) ?? updatedOrder

          results.push({
            orderId: updatedOrder.id,
            eligible: true,
            action: "sent",
            provider,
            reason: tpeCloudDecision.reason,
            evaluateAfter,
            routeMessageType,
            routingCarrier,
            routingPlan,
            availableProviders: providerPlan,
            messageId: tpeCloudMessage.messageId,
          })

          sent = true
          break
        }

        if (provider === "twilio") {
          const twilioMessage = await sendTwilioSmsMessage({
            to: fallbackPayload.target,
            body: fallbackPayload.message,
            statusCallback: getTwilioSmsStatusCallbackUrl(),
          })

          let updatedOrder = withMergedMetadata(workingOrder, {
            notifications: {
              ...(workingOrder.metadata?.notifications ?? {}),
              twilioSmsFallback: {
                ...(workingOrder.metadata?.notifications?.twilioSmsFallback ?? {}),
                enabled: true,
                target: twilioMessage.to,
                message: fallbackPayload.message,
                messageSid: twilioMessage.sid,
                status: twilioMessage.status || "sent",
                sentAt: now.toISOString(),
                lastEvaluatedAt: now.toISOString(),
                skippedReason: undefined,
              },
            },
          })

          await persistManualBillingOrder(updatedOrder)
          updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
            channel: "automation",
            event: "manual_billing.twilio_sms_fallback",
            outcome: "delivered",
            detail: `Twilio SMS sent via ${routeMessageType}/${routingCarrier} routing policy`,
            payload: {
              messageSid: twilioMessage.sid,
              target: twilioMessage.to,
              status: twilioMessage.status,
            },
          })) ?? updatedOrder

          results.push({
            orderId: updatedOrder.id,
            eligible: true,
            action: "sent",
            provider,
            reason: twilioDecision.reason,
            evaluateAfter,
            routeMessageType,
            routingCarrier,
            routingPlan,
            availableProviders: providerPlan,
            messageSid: twilioMessage.sid,
          })

          sent = true
          break
        }

        if (provider === "orange") {
          const orangeMessage = await sendOrangeSmsMessage({
            to: fallbackPayload.target,
            message: fallbackPayload.message,
          })

          let updatedOrder = withMergedMetadata(workingOrder, {
            notifications: {
              ...(workingOrder.metadata?.notifications ?? {}),
              orangeFallback: {
                ...(workingOrder.metadata?.notifications?.orangeFallback ?? {}),
                enabled: true,
                target: orangeMessage.to,
                message: fallbackPayload.message,
                resourceId: orangeMessage.resourceId,
                resourceUrl: orangeMessage.resourceUrl,
                status: "sent",
                sentAt: now.toISOString(),
                lastEvaluatedAt: now.toISOString(),
                skippedReason: undefined,
              },
            },
          })

          await persistManualBillingOrder(updatedOrder)
          updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
            channel: "automation",
            event: "manual_billing.orange_fallback_sms",
            outcome: "delivered",
            detail: `Orange SMS sent via ${routeMessageType}/${routingCarrier} routing policy`,
            payload: {
              resourceId: orangeMessage.resourceId,
              resourceUrl: orangeMessage.resourceUrl,
              target: orangeMessage.to,
            },
          })) ?? updatedOrder

          results.push({
            orderId: updatedOrder.id,
            eligible: true,
            action: "sent",
            provider,
            reason: orangeDecision.reason,
            evaluateAfter,
            routeMessageType,
            routingCarrier,
            routingPlan,
            availableProviders: providerPlan,
            resourceId: orangeMessage.resourceId,
          })

          sent = true
          break
        }

        if (provider === "mtn") {
          const mtnMessage = await sendMtnSmsMessage({
            to: fallbackPayload.target,
            message: fallbackPayload.message,
          })

          let updatedOrder = withMergedMetadata(workingOrder, {
            notifications: {
              ...(workingOrder.metadata?.notifications ?? {}),
              mtnFallback: {
                ...(workingOrder.metadata?.notifications?.mtnFallback ?? {}),
                enabled: true,
                target: mtnMessage.to,
                message: fallbackPayload.message,
                requestId: mtnMessage.requestId,
                transactionId: mtnMessage.transactionId,
                clientCorrelator: mtnMessage.clientCorrelator,
                resourceUrl: mtnMessage.resourceUrl,
                status: mtnMessage.status || "sent",
                sentAt: now.toISOString(),
                lastEvaluatedAt: now.toISOString(),
                skippedReason: undefined,
              },
            },
          })

          await persistManualBillingOrder(updatedOrder)
          updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
            channel: "automation",
            event: "manual_billing.mtn_fallback_sms",
            outcome: "delivered",
            detail: `MTN SMS sent via ${routeMessageType}/${routingCarrier} routing policy`,
            payload: {
              requestId: mtnMessage.requestId,
              transactionId: mtnMessage.transactionId,
              clientCorrelator: mtnMessage.clientCorrelator,
              resourceUrl: mtnMessage.resourceUrl,
              target: mtnMessage.to,
            },
          })) ?? updatedOrder

          results.push({
            orderId: updatedOrder.id,
            eligible: true,
            action: "sent",
            provider,
            reason: mtnDecision.reason,
            evaluateAfter,
            routeMessageType,
            routingCarrier,
            routingPlan,
            availableProviders: providerPlan,
            requestId: mtnMessage.requestId,
          })

          sent = true
          break
        }

        const africasTalkingMessage = await sendAfricasTalkingSmsMessage({
          to: fallbackPayload.target,
          message: fallbackPayload.message,
        })

        let updatedOrder = withMergedMetadata(workingOrder, {
          notifications: {
            ...(workingOrder.metadata?.notifications ?? {}),
            africasTalkingFallback: {
              ...(workingOrder.metadata?.notifications?.africasTalkingFallback ?? {}),
              enabled: true,
              target: africasTalkingMessage.to,
              message: fallbackPayload.message,
              messageId: africasTalkingMessage.messageId,
              cost: africasTalkingMessage.cost,
              status: africasTalkingMessage.status || "sent",
              statusCode: africasTalkingMessage.statusCode,
              summaryMessage: africasTalkingMessage.summaryMessage,
              sentAt: now.toISOString(),
              lastEvaluatedAt: now.toISOString(),
              skippedReason: undefined,
            },
          },
        })

        await persistManualBillingOrder(updatedOrder)
        updatedOrder = (await recordManualOrderAuditEvent(updatedOrder.id, {
          channel: "automation",
          event: "manual_billing.africas_talking_fallback_sms",
          outcome: "delivered",
          detail: `AfricasTalking SMS sent via ${routeMessageType}/${routingCarrier} routing policy`,
          payload: {
            messageId: africasTalkingMessage.messageId,
            cost: africasTalkingMessage.cost,
            status: africasTalkingMessage.status,
            statusCode: africasTalkingMessage.statusCode,
            summaryMessage: africasTalkingMessage.summaryMessage,
            target: africasTalkingMessage.to,
          },
        })) ?? updatedOrder

        results.push({
          orderId: updatedOrder.id,
          eligible: true,
          action: "sent",
          provider,
          reason: africasTalkingDecision.reason,
          evaluateAfter,
          routeMessageType,
          routingCarrier,
          routingPlan,
          availableProviders: providerPlan,
          messageId: africasTalkingMessage.messageId,
          cost: africasTalkingMessage.cost,
        })

        sent = true
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : `${getSmsFallbackProviderLabel(provider)} fallback SMS failed`
        attemptErrors.push(`${getSmsFallbackProviderLabel(provider)}: ${message}`)
        workingOrder = withSmsFallbackAttemptRecorded(workingOrder, provider, fallbackPayload.target, fallbackPayload.message, now.toISOString(), message)
        await persistManualBillingOrder(workingOrder)
        workingOrder = (await recordManualOrderAuditEvent(workingOrder.id, {
          channel: "automation",
          event: getSmsFallbackProviderEvent(provider),
          outcome: "failed",
          detail: message,
        })) ?? workingOrder
      }
    }

    if (!sent) {
      results.push({
        orderId: order.id,
        eligible: true,
        action: "skipped",
        provider: providerPlan[0],
        routeMessageType,
        routingCarrier,
        routingPlan,
        availableProviders: providerPlan,
        reason: [...providerIssues, ...attemptErrors].join("; ") || "No configured SMS fallback provider is available",
        evaluateAfter,
      })
    }
  }

  return {
    settings: {
      twilioSmsFallbackEnabled: settings.twilioSmsFallbackEnabled,
      orangeFallbackEnabled: settings.orangeFallbackEnabled,
      mtnFallbackEnabled: settings.mtnFallbackEnabled,
      africasTalkingFallbackEnabled: settings.africasTalkingFallbackEnabled,
      tpeCloudFallbackEnabled: settings.tpeCloudFallbackEnabled,
      whatsappFallbackDelayMinutes: settings.whatsappFallbackDelayMinutes,
      routingPolicy: settings.routingPolicy,
    },
    evaluatedAt: now.toISOString(),
    results,
    summary: {
      evaluated: results.length,
      eligible: results.filter((result) => result.eligible).length,
      sent: results.filter((result) => result.action === "sent").length,
    },
  }
}

export async function runManualBillingOpsTestHook(input: ManualBillingOpsTestHookInput) {
  let order = input.orderId ? await getPersistedManualOrder(input.orderId) : null

  if (!order && input.createOrder) {
    order = await createManualOrder(input.createOrder)
  }

  if (!order) {
    throw new Error("A valid orderId or createOrder payload is required")
  }

  if (typeof input.quotedAmount === "number" && order.status === "quote_requested") {
    order = await setManualQuote({
      orderId: order.id,
      quotedAmount: input.quotedAmount,
      adminQuoteNotes: "Internal ops test quote"
    })
  }

  if (input.createCheckoutSession && order.status === "quote_ready") {
    const checkout = await createManualCheckoutSession(order.id)
    order = checkout.order
  }

  if (input.markPaid && order.status === "payment_pending") {
    order = await markManualOrderPaid(order.id, input.paymentSessionId || `ops-test-${Date.now()}`)
  }

  if (input.autoProgress && order.status === "paid") {
    order = await advanceManualOrderOperatorState(order.id, "start", {
      source: "admin",
      adminExecutionNotes: "Internal ops test progression"
    })
  }

  if (input.autoProgress && order.status === "operator_started") {
    order = await advanceManualOrderOperatorState(order.id, "confirm", {
      source: "admin",
      adminExecutionNotes: "Internal ops test progression"
    })
  }

  if (input.autoProgress && order.status === "operator_confirmed") {
    order = await advanceManualOrderOperatorState(order.id, "complete", {
      source: "admin",
      adminExecutionNotes: "Internal ops test completion",
      fulfillment: input.fulfillment
    })
  }

  const fallbackResult = input.fallback
    ? await runManualBillingSmsFallbackEvaluation({
        dryRun: input.fallback.dryRun,
        limit: input.fallback.limit,
        now: input.fallback.overrideNow,
        settingsOverride: input.fallback.settingsOverride,
      })
    : null

  const refreshedOrder = await getPersistedManualOrder(order.id)

  return {
    order: refreshedOrder ?? order,
    fallbackResult,
    fallbackMatch: fallbackResult?.results.find((result) => result.orderId === order.id) ?? null,
  }
}

export async function runOrangeFallbackEvaluation(options: {
  dryRun?: boolean
  limit?: number
  now?: Date
} = {}) {
  return runManualBillingSmsFallbackEvaluation(options)
}

export async function resendManualOrderSmsDelivery(orderId: string) {
  const order = await getPersistedManualOrder(orderId)

  if (!order) {
    throw new Error("Manual billing order not found")
  }

  if (order.status !== "completed") {
    throw new Error("SMS resend is only available after the order is completed")
  }

  const result = await sendManualBillingSmsDelivery(order, {
    reason: "Customer requested SMS resend from the completion screen",
    routeMessageType: "retry",
  })

  return result.order
}