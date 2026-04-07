/**
 * Shared Stripe Client
 *
 * Single source of truth for the Stripe SDK instance and API version.
 * Imported by stripeGateway.ts (payment adapter) and the webhook route.
 */

import Stripe from "stripe"

const STRIPE_API_VERSION = "2026-02-25.clover" as Stripe.LatestApiVersion

let instance: Stripe | null = null

export function getStripe(): Stripe {
  if (!instance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
    instance = new Stripe(key, { apiVersion: STRIPE_API_VERSION })
  }
  return instance
}

/** Reset singleton — for testing only */
export function resetStripeClient() {
  instance = null
}
