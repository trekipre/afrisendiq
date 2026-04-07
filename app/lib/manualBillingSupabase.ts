import { getSupabase } from "@/app/lib/supabase"
import type {
  ManualBillingAuditEvent,
  ManualBillingOrder,
  ManualBillingPricingSummary,
  ManualBillingTransition
} from "@/app/lib/manualBillingState"

type ManualBillingRow = {
  id: string
  trace_id: string
  service: string
  country_code: string
  account_reference: string
  package_code: string | null
  package_label: string | null
  quoted_amount: number | null
  currency: string
  status: string
  payment_session_id: string | null
  stripe_payment_status: string | null
  admin_quote_notes: string | null
  admin_execution_notes: string | null
  telegram_message_id: string | null
  pricing_input_amount: number | null
  pricing_provider_cost: number | null
  pricing_customer_price: number | null
  pricing_margin: number | null
  pricing_margin_percent: number | null
  pricing_strategy: string | null
  pricing_decision: Record<string, unknown> | null
  pricing_payment_method: string | null
  pricing_user_country_code: string | null
  ai_location_cluster: string | null
  ai_profile_source: "static" | "learned" | null
  metadata: Record<string, unknown> | null
  failure_reason: string | null
  customer: ManualBillingOrder["customer"]
  transitions: ManualBillingTransition[]
  created_at: string
  updated_at: string
}

type ManualBillingAuditRow = {
  id: string
  order_id: string
  trace_id: string
  service: string
  channel: ManualBillingAuditEvent["channel"]
  event: string
  outcome: ManualBillingAuditEvent["outcome"]
  detail: string | null
  payload: Record<string, unknown> | null
  recorded_at: string
}

function mapPricingSummary(
  row: Pick<ManualBillingRow, "pricing_input_amount" | "pricing_provider_cost" | "pricing_customer_price" | "pricing_margin" | "pricing_margin_percent" | "pricing_strategy" | "pricing_decision" | "metadata">
): ManualBillingPricingSummary | undefined {
  if (
    row.pricing_input_amount !== null &&
    row.pricing_provider_cost !== null &&
    row.pricing_customer_price !== null &&
    row.pricing_margin !== null &&
    row.pricing_margin_percent !== null &&
    row.pricing_strategy &&
    row.pricing_decision
  ) {
    return {
      source: "manual-billing-profit-engine",
      inputAmount: row.pricing_input_amount,
      providerCost: row.pricing_provider_cost,
      customerPrice: row.pricing_customer_price,
      afrisendiqMargin: row.pricing_margin,
      afrisendiqMarginPercent: row.pricing_margin_percent,
      pricingStrategy: row.pricing_strategy as ManualBillingPricingSummary["pricingStrategy"],
      pricingDecision: row.pricing_decision as ManualBillingPricingSummary["pricingDecision"]
    }
  }

  const metadataPricing = row.metadata?.manualPricing
  if (!metadataPricing || typeof metadataPricing !== "object") {
    return undefined
  }

  return metadataPricing as ManualBillingPricingSummary
}

function mapRowToOrder(row: ManualBillingRow): ManualBillingOrder {
  return {
    id: row.id,
    traceId: row.trace_id,
    service: row.service as ManualBillingOrder["service"],
    countryCode: row.country_code as "CI",
    accountReference: row.account_reference,
    packageCode: row.package_code ?? undefined,
    packageLabel: row.package_label ?? undefined,
    quotedAmount: row.quoted_amount ?? undefined,
    currency: row.currency as "XOF",
    status: row.status as ManualBillingOrder["status"],
    paymentSessionId: row.payment_session_id ?? undefined,
    stripePaymentStatus: (row.stripe_payment_status as ManualBillingOrder["stripePaymentStatus"]) ?? undefined,
    adminQuoteNotes: row.admin_quote_notes ?? undefined,
    adminExecutionNotes: row.admin_execution_notes ?? undefined,
    telegramMessageId: row.telegram_message_id ?? undefined,
    pricingSummary: mapPricingSummary(row),
    metadata: row.metadata ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    customer: row.customer,
    transitions: row.transitions ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapOrderToRow(order: ManualBillingOrder) {
  const aiOptimization = order.pricingSummary?.pricingDecision?.aiOptimization

  return {
    id: order.id,
    trace_id: order.traceId,
    service: order.service,
    country_code: order.countryCode,
    account_reference: order.accountReference,
    package_code: order.packageCode ?? null,
    package_label: order.packageLabel ?? null,
    quoted_amount: order.quotedAmount ?? null,
    currency: order.currency,
    status: order.status,
    payment_session_id: order.paymentSessionId ?? null,
    stripe_payment_status: order.stripePaymentStatus ?? null,
    admin_quote_notes: order.adminQuoteNotes ?? null,
    admin_execution_notes: order.adminExecutionNotes ?? null,
    telegram_message_id: order.telegramMessageId ?? null,
    pricing_input_amount: order.pricingSummary?.inputAmount ?? null,
    pricing_provider_cost: order.pricingSummary?.providerCost ?? null,
    pricing_customer_price: order.pricingSummary?.customerPrice ?? null,
    pricing_margin: order.pricingSummary?.afrisendiqMargin ?? null,
    pricing_margin_percent: order.pricingSummary?.afrisendiqMarginPercent ?? null,
    pricing_strategy: order.pricingSummary?.pricingStrategy ?? null,
    pricing_decision: order.pricingSummary?.pricingDecision ?? null,
    pricing_payment_method: aiOptimization?.paymentMethod ?? (order.pricingSummary ? "manual" : null),
    pricing_user_country_code: aiOptimization?.userCountryCode ?? (order.pricingSummary ? order.countryCode : null),
    ai_location_cluster: aiOptimization?.locationCluster ?? null,
    ai_profile_source: aiOptimization?.locationProfileSource ?? null,
    metadata: order.metadata ?? null,
    failure_reason: order.failureReason ?? null,
    customer: order.customer,
    transitions: order.transitions,
    created_at: order.createdAt,
    updated_at: order.updatedAt
  }
}

export async function persistManualBillingOrder(order: ManualBillingOrder) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from("manual_billing_orders")
    .upsert(mapOrderToRow(order), { onConflict: "id" })

  if (error) {
    console.error("[supabase] Failed to persist manual billing order:", error.message)
  }

  return !error
}

export async function fetchManualBillingOrder(orderId: string): Promise<ManualBillingOrder | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("manual_billing_orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (error || !data) {
    return null
  }

  return mapRowToOrder(data as ManualBillingRow)
}

export async function listManualBillingOrdersFromSupabase(): Promise<ManualBillingOrder[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("manual_billing_orders")
    .select("*")
    .order("created_at", { ascending: false })

  if (error || !data) {
    if (error) {
      console.error("[supabase] Failed to list manual billing orders:", error.message)
    }

    return []
  }

  return (data as ManualBillingRow[]).map(mapRowToOrder)
}

function mapAuditRowToEvent(row: ManualBillingAuditRow): ManualBillingAuditEvent {
  return {
    id: row.id,
    channel: row.channel,
    event: row.event,
    outcome: row.outcome,
    detail: row.detail ?? undefined,
    payload: row.payload ?? undefined,
    recordedAt: row.recorded_at
  }
}

export async function persistManualBillingAuditEvent(order: ManualBillingOrder, auditEvent: ManualBillingAuditEvent) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from("manual_billing_audit_events")
    .upsert(
      {
        id: auditEvent.id,
        order_id: order.id,
        trace_id: order.traceId,
        service: order.service,
        channel: auditEvent.channel,
        event: auditEvent.event,
        outcome: auditEvent.outcome,
        detail: auditEvent.detail ?? null,
        payload: auditEvent.payload ?? null,
        recorded_at: auditEvent.recordedAt
      },
      { onConflict: "id" }
    )

  if (error) {
    console.error("[supabase] Failed to persist manual billing audit event:", error.message)
  }

  return !error
}

export async function listManualBillingAuditEvents(orderId: string): Promise<ManualBillingAuditEvent[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("manual_billing_audit_events")
    .select("*")
    .eq("order_id", orderId)
    .order("recorded_at", { ascending: true })

  if (error || !data) {
    if (error) {
      console.error("[supabase] Failed to list manual billing audit events:", error.message)
    }

    return []
  }

  return (data as ManualBillingAuditRow[]).map(mapAuditRowToEvent)
}