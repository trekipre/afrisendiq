import { stripePaymentService } from "@/app/lib/services/paymentService"
import { recordInboundWebhookEvent } from "@/app/lib/webhookEventSupabase"

export type WebhookProvider = "stripe" | "flutterwave" | "pawapay" | "africastalking"

export type CanonicalWebhookEnvelope = {
  provider: WebhookProvider
  eventId: string
  eventType: string
  domainType: "payment" | "payout" | "provider" | "unknown"
  domainReference?: string
  orderId?: string
  payload: unknown
}

export interface WebhookAdapter {
  readonly provider: WebhookProvider
  verifyAndNormalize(input: {
    payload: string
    signature?: string
    headers?: Record<string, string>
  }): Promise<CanonicalWebhookEnvelope>
}

export interface WebhookService {
  verifyAndNormalize(provider: WebhookProvider, input: {
    payload: string
    signature?: string
    headers?: Record<string, string>
  }): Promise<CanonicalWebhookEnvelope>
  recordReceipt(envelope: CanonicalWebhookEnvelope): Promise<CanonicalWebhookEnvelope>
  dispatch(envelope: CanonicalWebhookEnvelope): Promise<CanonicalWebhookEnvelope>
}

class WebhookRegistryService implements WebhookService {
  constructor(private readonly adapters: Record<WebhookProvider, WebhookAdapter>) {}

  async verifyAndNormalize(provider: WebhookProvider, input: {
    payload: string
    signature?: string
    headers?: Record<string, string>
  }) {
    return this.adapters[provider].verifyAndNormalize(input)
  }

  async recordReceipt(envelope: CanonicalWebhookEnvelope) {
    await recordInboundWebhookEvent(envelope)
    return envelope
  }

  async dispatch(envelope: CanonicalWebhookEnvelope) {
    return envelope
  }
}

export const stripeWebhookAdapter: WebhookAdapter = {
  provider: "stripe",
  async verifyAndNormalize(input) {
    const verified = await stripePaymentService.verifyWebhook({
      payload: input.payload,
      signature: input.signature || "",
    })

    let domainType: CanonicalWebhookEnvelope["domainType"] = "unknown"
    if (verified.eventType.startsWith("checkout.") || verified.eventType.startsWith("charge.")) {
      domainType = "payment"
    }

    return {
      provider: "stripe",
      eventId: verified.eventId,
      eventType: verified.eventType,
      domainType,
      domainReference: verified.paymentId,
      orderId: verified.orderId,
      payload: verified.raw,
    }
  },
}

export const flutterwaveWebhookAdapter: WebhookAdapter = {
  provider: "flutterwave",
  async verifyAndNormalize() {
    throw new Error("Flutterwave webhook adapter is scaffolded but not implemented yet")
  },
}

export const pawapayWebhookAdapter: WebhookAdapter = {
  provider: "pawapay",
  async verifyAndNormalize() {
    throw new Error("PawaPay webhook adapter is scaffolded but not implemented yet")
  },
}

export const africasTalkingWebhookAdapter: WebhookAdapter = {
  provider: "africastalking",
  async verifyAndNormalize() {
    throw new Error("Africa's Talking webhook adapter is scaffolded but not implemented yet")
  },
}

export const webhookService = new WebhookRegistryService({
  stripe: stripeWebhookAdapter,
  flutterwave: flutterwaveWebhookAdapter,
  pawapay: pawapayWebhookAdapter,
  africastalking: africasTalkingWebhookAdapter,
})