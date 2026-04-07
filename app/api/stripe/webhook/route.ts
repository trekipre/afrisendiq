/**
 * Stripe Webhook Handler
 *
 * Fully automates: payment → JIT provider purchase → confirmation
 *
 * Listens for:
 *   checkout.session.completed  — customer paid → execute JIT provider purchase
 *   charge.refunded             — track refund in Supabase
 *
 * Every webhook event is idempotent (checked against webhook_events table).
 * All state changes are persisted to Supabase for auditability.
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY         — Stripe API key
 *   STRIPE_WEBHOOK_SECRET     — webhook endpoint signing secret
 */

import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import {
  getJitOrder,
  executeAfterPayment,
  type JitDependencies
} from "@/app/lib/jitPurchaseEngine"
import {
  persistJitOrder,
  persistSettlement,
  persistGuardAudit,
  isWebhookProcessed,
  markWebhookProcessed,
  fetchJitOrder
} from "@/app/lib/supabaseOrders"
import { markManualOrderPaid, recordManualOrderAuditEvent } from "@/app/lib/manualBilling"
import { executeSoutraliTrackedOrderAfterPayment } from "@/app/lib/soutraliTrackedPayments"
import { stripeGateway } from "@/app/lib/stripeGateway"
import { getStripeWebhookSecrets } from "@/app/lib/services/paymentService"
import { webhookService } from "@/app/lib/services/webhookService"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// Build deps for webhook-context execution
// ---------------------------------------------------------------------------

function buildWebhookDeps(): JitDependencies {
  return {
    paymentGateway: stripeGateway,

    providerExecutor: {
      async execute(input) {
        // Dynamic import to avoid circular deps — the provider execution
        // module decides whether to use Reloadly, Ding, or DTone.
        const { routeProviderExecution } = await import("@/app/lib/providerExecution")
        return routeProviderExecution({
          provider: input.provider,
          productId: input.providerProductId,
          amount: input.amount,
          phone: input.customerReference,
          reference: input.reference,
          traceId: input.traceId
        }) as Promise<Record<string, unknown>>
      }
    },

    profitEngine: {
      // These are not called during webhook execution — pricing was
      // already computed at quote time. Provide stubs.
      getCompetitorPrices: async () => [],
      getProviderCosts: async () => []
    },

    createReference: () => crypto.randomUUID(),
    createTraceId: () => crypto.randomUUID(),

    onSettlement: async (record) => {
      await persistSettlement(record)
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook
// ---------------------------------------------------------------------------

function getWebhookConfigurationSummary() {
  const webhookSecrets = getStripeWebhookSecrets()

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const stripeKeyMode = stripeSecretKey?.startsWith("sk_live_")
    ? "live"
    : stripeSecretKey?.startsWith("sk_test_")
      ? "test"
      : "unknown"

  return {
    webhookSecrets,
    stripeKeyMode,
    paymentsLiveEnabled: process.env.PAYMENTS_LIVE_ENABLED === "true"
  }
}

export async function GET() {
  const { webhookSecrets, stripeKeyMode, paymentsLiveEnabled } = getWebhookConfigurationSummary()

  return NextResponse.json({
    ok: true,
    endpoint: "stripe-webhook",
    webhookSecretsConfigured: webhookSecrets.length > 0,
    webhookSecretCount: webhookSecrets.length,
    stripeKeyMode,
    paymentsLiveEnabled
  })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

export async function POST(req: NextRequest) {
  const { webhookSecrets, stripeKeyMode, paymentsLiveEnabled } = getWebhookConfigurationSummary()

  if (webhookSecrets.length === 0) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  // 1. Verify Stripe signature
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const envelope = await webhookService.verifyAndNormalize("stripe", {
      payload: body,
      signature,
      headers: Object.fromEntries(req.headers.entries()),
    })
    await webhookService.recordReceipt(envelope)
    event = envelope.payload as Stripe.Event
  } catch (error) {
    console.warn("[webhook] Invalid Stripe signature", {
      webhookSecretCount: webhookSecrets.length,
      stripeKeyMode,
      paymentsLiveEnabled,
      error: error instanceof Error ? error.message : "unknown"
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const manualBillingOrderId = getManualBillingOrderIdFromEvent(event)

  // 2. Idempotency — skip if this event was already processed
  if (await isWebhookProcessed(event.id)) {
    if (manualBillingOrderId) {
      await recordManualOrderAuditEvent(manualBillingOrderId, {
        channel: "stripe_webhook",
        event: event.type,
        outcome: "duplicate",
        payload: {
          eventId: event.id
        }
      })
    }

    return NextResponse.json({ received: true, note: "already processed" })
  }

  if (manualBillingOrderId) {
    await recordManualOrderAuditEvent(manualBillingOrderId, {
      channel: "stripe_webhook",
      event: event.type,
      outcome: "received",
      payload: {
        eventId: event.id
      }
    })
  }

  // 3. Route by event type
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case "charge.refunded":
        await handleRefund(event.data.object as Stripe.Charge)
        break

      default:
        // Acknowledge but ignore unhandled events
        break
    }

    await markWebhookProcessed(event.id, event.type)

    if (manualBillingOrderId) {
      await recordManualOrderAuditEvent(manualBillingOrderId, {
        channel: "stripe_webhook",
        event: event.type,
        outcome: "processed",
        payload: {
          eventId: event.id
        }
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`[webhook] Failed to process ${event.type}:`, error)
    // Return 200 to prevent Stripe from retrying endlessly on business errors.
    // The error is logged and can be investigated via Supabase audit trail.
    await markWebhookProcessed(event.id, event.type, {
      error: error instanceof Error ? error.message : "unknown"
    })

    if (manualBillingOrderId) {
      await recordManualOrderAuditEvent(manualBillingOrderId, {
        channel: "stripe_webhook",
        event: event.type,
        outcome: "failed",
        detail: error instanceof Error ? error.message : "unknown",
        payload: {
          eventId: event.id
        }
      })
    }

    return NextResponse.json({ received: true, error: "processing failed" })
  }
}

function getManualBillingOrderIdFromEvent(event: Stripe.Event) {
  if (event.type !== "checkout.session.completed") {
    return null
  }

  const session = event.data.object as Stripe.Checkout.Session
  return session.metadata?.orderType === "manual_billing" ? session.metadata?.orderId ?? null : null
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId
  if (!orderId) {
    console.error("[webhook] checkout.session.completed missing orderId in metadata")
    return
  }

  if (session.metadata?.orderType === "manual_billing") {
    await markManualOrderPaid(orderId, session.id)
    console.log(`[webhook] Manual billing order ${orderId} marked paid`)
    return
  }

  if (session.metadata?.orderType === "soutrali_tracked") {
    await executeSoutraliTrackedOrderAfterPayment(orderId)
    console.log(`[webhook] Soutrali tracked order ${orderId} marked paid and submitted`)
    return
  }

  // Try in-memory first, then Supabase
  let order = getJitOrder(orderId)
  if (!order) {
    order = (await fetchJitOrder(orderId)) ?? undefined
  }

  if (!order) {
    console.error(`[webhook] Order ${orderId} not found`)
    return
  }

  if (order.status === "settled" || order.status === "refunded") {
    return // Already terminal — idempotent no-op
  }

  // Payment confirmed event from Stripe — trigger the JIT execution
  const deps = buildWebhookDeps()

  const { order: updatedOrder } = await executeAfterPayment(orderId, deps)

  // Persist final state to Supabase
  await persistJitOrder(updatedOrder)

  // Persist guard audit trail if available
  if (updatedOrder.guardResult) {
    await persistGuardAudit(updatedOrder.traceId, updatedOrder.guardResult.verdicts)
  }

  console.log(
    `[webhook] Order ${orderId} → ${updatedOrder.status}`,
    updatedOrder.status === "settled"
      ? `| margin: ${updatedOrder.afrisendiqMargin} ${updatedOrder.currency}`
      : `| reason: ${updatedOrder.failureReason}`
  )
}

async function handleRefund(charge: Stripe.Charge) {
  // Find the order linked to this charge's payment intent
  const pi = charge.payment_intent
  if (!pi) return

  // We stored the checkout session ID as paymentIntentId on the order.
  // The charge's metadata may have the orderId directly.
  const orderId = charge.metadata?.orderId
  if (!orderId) return

  const order = getJitOrder(orderId) || (await fetchJitOrder(orderId))
  if (!order) return

  if (order.status !== "refunded") {
    // Update status in Supabase
    await persistJitOrder({
      ...order,
      status: "refunded",
      updatedAt: new Date().toISOString(),
      failureReason: "Refunded via Stripe"
    })
  }
}
