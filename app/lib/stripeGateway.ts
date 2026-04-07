/**
 * Stripe Payment Gateway Adapter
 *
 * Implements JitPaymentGateway using the Stripe SDK.
 * Creates Checkout Sessions (not raw PaymentIntents) so customers
 * complete payment on a hosted Stripe page, then the webhook confirms.
 *
 * Amounts are in XOF (zero-decimal currency) — Stripe receives the
 * integer amount directly (no ×100 conversion).
 */

import type { JitPaymentGateway, PaymentIntent } from "@/app/lib/jitPurchaseEngine"
import { stripePaymentService } from "@/app/lib/services/paymentService"

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const stripeGateway: JitPaymentGateway = {
  async createPaymentIntent(input) {
    const session = await stripePaymentService.createCheckoutSession({
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"}/cote-divoire?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"}/cote-divoire?cancelled=true`,
      metadata: Object.entries(input.metadata || {}).reduce<Record<string, string>>((result, [key, value]) => {
        result[key] = String(value)
        return result
      }, {}),
    })

    return {
      id: session.paymentId,
      amount: input.amount,
      currency: input.currency,
      status: "pending",
      createdAt: new Date().toISOString()
    }
  },

  async confirmPayment(paymentIntentId) {
    const session = await stripePaymentService.getPayment(paymentIntentId)
    const paid = session.status === "paid"

    return {
      id: paymentIntentId,
      amount: session.amount || 0,
      currency: session.currency || "xof",
      status: paid ? "confirmed" : "pending",
      createdAt: new Date().toISOString()
    } satisfies PaymentIntent
  },

  async refundPayment(paymentIntentId, reason) {
    const session = await stripePaymentService.refundPayment(paymentIntentId, reason)

    return {
      id: paymentIntentId,
      amount: session.amount || 0,
      currency: session.currency || "xof",
      status: "refunded",
      createdAt: new Date().toISOString()
    } satisfies PaymentIntent
  }
}
