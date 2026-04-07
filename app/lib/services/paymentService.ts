import type Stripe from "stripe"
import { getStripe } from "@/app/lib/stripe"

export type PaymentProvider = "stripe" | "flutterwave"

export type PaymentSessionInput = {
  orderId: string
  amount: number
  currency: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  metadata?: Record<string, string>
}

export type CanonicalPaymentStatus =
  | "created"
  | "requires_action"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "chargeback_open"
  | "chargeback_won"
  | "chargeback_lost"

export type CanonicalPayment = {
  provider: PaymentProvider
  paymentId: string
  status: CanonicalPaymentStatus
  amount: number
  currency: string
  checkoutUrl?: string
  providerReference?: string
  raw?: unknown
}

export type PaymentWebhookVerificationInput = {
  signature: string
  payload: string
}

export type CanonicalPaymentWebhook = {
  provider: PaymentProvider
  eventId: string
  eventType: string
  paymentId?: string
  orderId?: string
  raw: unknown
}

export function getStripeWebhookSecrets() {
  return [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CLI_WEBHOOK_SECRET,
    ...String(process.env.STRIPE_WEBHOOK_SECRETS || "")
      .split(",")
      .map((secret) => secret.trim())
      .filter(Boolean),
  ].filter((secret, index, secrets): secret is string => Boolean(secret) && secrets.indexOf(secret) === index)
}

export interface PaymentService {
  readonly provider: PaymentProvider
  createCheckoutSession(input: PaymentSessionInput): Promise<CanonicalPayment>
  getPayment(paymentId: string): Promise<CanonicalPayment>
  refundPayment(paymentId: string, reason: string): Promise<CanonicalPayment>
  verifyWebhook(input: PaymentWebhookVerificationInput): Promise<CanonicalPaymentWebhook>
}

function mapStripeSessionStatus(session: Stripe.Checkout.Session): CanonicalPaymentStatus {
  if (session.payment_status === "paid") {
    return "paid"
  }

  if (session.status === "expired") {
    return "failed"
  }

  if (session.status === "complete") {
    return "authorized"
  }

  return "created"
}

export const stripePaymentService: PaymentService = {
  provider: "stripe",

  async createCheckoutSession(input) {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: input.customerEmail,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: Math.round(input.amount),
            product_data: {
              name: `AfriSendIQ Order ${input.orderId}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        orderId: input.orderId,
        ...(input.metadata || {}),
      },
    })

    return {
      provider: "stripe",
      paymentId: session.id,
      status: mapStripeSessionStatus(session),
      amount: session.amount_total || input.amount,
      currency: session.currency || input.currency,
      checkoutUrl: session.url ?? undefined,
      providerReference: session.payment_intent ? String(session.payment_intent) : undefined,
      raw: session,
    }
  },

  async getPayment(paymentId) {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(paymentId)

    return {
      provider: "stripe",
      paymentId: session.id,
      status: mapStripeSessionStatus(session),
      amount: session.amount_total || 0,
      currency: session.currency || "xof",
      checkoutUrl: session.url ?? undefined,
      providerReference: session.payment_intent ? String(session.payment_intent) : undefined,
      raw: session,
    }
  },

  async refundPayment(paymentId, reason) {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(paymentId)
    const paymentIntent = session.payment_intent

    if (!paymentIntent) {
      throw new Error("No Stripe payment intent linked to checkout session")
    }

    await stripe.refunds.create({
      payment_intent: typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id,
      reason: "requested_by_customer",
      metadata: {
        afrisendiq_reason: reason.slice(0, 500),
      },
    })

    return {
      provider: "stripe",
      paymentId,
      status: "refunded",
      amount: session.amount_total || 0,
      currency: session.currency || "xof",
      providerReference: typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id,
      raw: session,
    }
  },

  async verifyWebhook(input) {
    const stripe = getStripe()
    const secrets = getStripeWebhookSecrets()

    if (secrets.length === 0) {
      throw new Error("No Stripe webhook signing secret is configured")
    }

    let event: Stripe.Event | null = null
    let lastError: unknown = null

    for (const secret of secrets) {
      try {
        event = stripe.webhooks.constructEvent(input.payload, input.signature, secret)
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!event) {
      throw lastError ?? new Error("Invalid Stripe webhook signature")
    }

    const checkoutSession = event.data.object as Stripe.Checkout.Session

    return {
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      paymentId: checkoutSession.id,
      orderId: checkoutSession.metadata?.orderId,
      raw: event,
    }
  },
}

export const flutterwavePaymentService: PaymentService = {
  provider: "flutterwave",

  async createCheckoutSession() {
    throw new Error("Flutterwave adapter is scaffolded but not implemented yet")
  },

  async getPayment() {
    throw new Error("Flutterwave adapter is scaffolded but not implemented yet")
  },

  async refundPayment() {
    throw new Error("Flutterwave adapter is scaffolded but not implemented yet")
  },

  async verifyWebhook() {
    throw new Error("Flutterwave adapter is scaffolded but not implemented yet")
  },
}

export function getPaymentService(provider: PaymentProvider): PaymentService {
  switch (provider) {
    case "stripe":
      return stripePaymentService
    case "flutterwave":
      return flutterwavePaymentService
    default:
      throw new Error(`Unsupported payment provider: ${provider satisfies never}`)
  }
}