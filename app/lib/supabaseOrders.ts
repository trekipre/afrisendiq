/**
 * Supabase Order Persistence
 *
 * Persists JIT orders, settlements, and audit trails to Supabase tables.
 * Works alongside the in-memory stores for hot-path speed — the database
 * is the durable record and the source of truth for async webhooks.
 *
 * Required Supabase tables (create via SQL editor):
 *
 * -- Orders table
 * CREATE TABLE jit_orders (
 *   id TEXT PRIMARY KEY,
 *   trace_id TEXT NOT NULL,
 *   product_id TEXT NOT NULL,
 *   product_type TEXT NOT NULL,
 *   customer_reference TEXT NOT NULL,
 *   recipient_label TEXT NOT NULL,
 *   amount NUMERIC NOT NULL,
 *   currency TEXT NOT NULL DEFAULT 'XOF',
 *   status TEXT NOT NULL DEFAULT 'received',
 *   quoted_price NUMERIC,
 *   provider_cost NUMERIC,
 *   margin NUMERIC,
 *   pricing_input_amount NUMERIC,
 *   pricing_provider_cost NUMERIC,
 *   pricing_customer_price NUMERIC,
 *   pricing_margin NUMERIC,
 *   pricing_margin_percent NUMERIC,
 *   pricing_gross_margin NUMERIC,
 *   pricing_gross_margin_percent NUMERIC,
 *   pricing_operating_cost NUMERIC,
 *   pricing_net_margin_after_fees NUMERIC,
 *   selected_provider TEXT,
 *   pricing_strategy TEXT,
 *   payment_intent_id TEXT,
 *   provider_reference TEXT,
 *   failure_reason TEXT,
 *   pricing_decision JSONB,
 *   guard_result JSONB,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Settlements (profit ledger)
 * CREATE TABLE settlements (
 *   id SERIAL PRIMARY KEY,
 *   order_id TEXT NOT NULL REFERENCES jit_orders(id),
 *   trace_id TEXT NOT NULL,
 *   customer_paid NUMERIC NOT NULL,
 *   provider_cost NUMERIC NOT NULL,
 *   margin NUMERIC NOT NULL,
 *   pricing_input_amount NUMERIC,
 *   pricing_provider_cost NUMERIC,
 *   pricing_customer_price NUMERIC,
 *   pricing_margin NUMERIC,
 *   pricing_margin_percent NUMERIC,
 *   pricing_gross_margin NUMERIC,
 *   pricing_gross_margin_percent NUMERIC,
 *   pricing_operating_cost NUMERIC,
 *   pricing_net_margin_after_fees NUMERIC,
 *   currency TEXT NOT NULL DEFAULT 'XOF',
 *   provider TEXT NOT NULL,
 *   pricing_strategy TEXT NOT NULL,
 *   pricing_decision JSONB,
 *   settled_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Guard audit trail
 * CREATE TABLE guard_audit (
 *   id SERIAL PRIMARY KEY,
 *   trace_id TEXT NOT NULL,
 *   guard TEXT NOT NULL,
 *   passed BOOLEAN NOT NULL,
 *   reason TEXT,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- Webhook events (idempotency + debugging)
 * CREATE TABLE webhook_events (
 *   id TEXT PRIMARY KEY,
 *   type TEXT NOT NULL,
 *   processed BOOLEAN NOT NULL DEFAULT FALSE,
 *   payload JSONB,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 */

import { getSupabase } from "@/app/lib/supabase"
import type { JitOrder, SettlementRecord } from "@/app/lib/jitPurchaseEngine"
import type { PricingDecision } from "@/app/lib/profitEngine"

type JitOrderRow = {
  id: string
  trace_id: string
  product_id: string
  product_type: string
  customer_reference: string
  recipient_label: string
  amount: number
  currency: string
  status: JitOrder["status"]
  quoted_price: number | null
  provider_cost: number | null
  margin: number | null
  pricing_input_amount: number | null
  pricing_provider_cost: number | null
  pricing_customer_price: number | null
  pricing_margin: number | null
  pricing_margin_percent: number | null
  pricing_gross_margin: number | null
  pricing_gross_margin_percent: number | null
  pricing_operating_cost: number | null
  pricing_net_margin_after_fees: number | null
  pricing_payment_method: string | null
  pricing_user_country_code: string | null
  ai_location_cluster: string | null
  ai_profile_source: "static" | "learned" | null
  selected_provider: string | null
  pricing_strategy: string | null
  payment_intent_id: string | null
  provider_reference: string | null
  failure_reason: string | null
  pricing_decision: PricingDecision | null
  guard_result: JitOrder["guardResult"] | null
  created_at: string
  updated_at: string
}

type SettlementRow = {
  order_id: string
  trace_id: string
  customer_paid: number
  provider_cost: number
  margin: number
  pricing_input_amount: number | null
  pricing_provider_cost: number | null
  pricing_customer_price: number | null
  pricing_margin: number | null
  pricing_margin_percent: number | null
  pricing_gross_margin: number | null
  pricing_gross_margin_percent: number | null
  pricing_operating_cost: number | null
  pricing_net_margin_after_fees: number | null
  pricing_payment_method: string | null
  pricing_user_country_code: string | null
  ai_location_cluster: string | null
  ai_profile_source: "static" | "learned" | null
  currency: string
  provider: string
  pricing_strategy: string
  pricing_decision: PricingDecision | null
  settled_at: string
}

export type ProfitabilityReportingRow = {
  flowType: "jit" | "manual_billing"
  orderId: string
  traceId: string
  serviceCategory: string
  serviceReference: string
  customerReference: string
  recipientLabel: string
  customerName?: string
  customerEmail?: string
  status: string
  currency: string
  inputAmount: number | null
  providerCost: number | null
  customerPrice: number | null
  netMargin: number | null
  netMarginPercent: number | null
  grossMargin: number | null
  grossMarginPercent: number | null
  operatingCost: number | null
  netMarginAfterFees: number | null
  paymentMethod?: string
  userCountryCode?: string
  aiLocationCluster?: string
  aiProfileSource?: "static" | "learned"
  provider?: string
  pricingStrategy?: string
  pricingDecision?: PricingDecision
  failureReason?: string
  realizedAt?: string
  createdAt: string
  updatedAt: string
  realized: boolean
}

export type SecurityDiagnosticsRow = {
  tableName: string
  classification: "sensitive" | "public_read_only"
  existsInSchema: boolean
  rowSecurityEnabled: boolean
  policyCount: number
  anonSelect: boolean
  anonInsert: boolean
  anonUpdate: boolean
  anonDelete: boolean
  authenticatedSelect: boolean
  authenticatedInsert: boolean
  authenticatedUpdate: boolean
  authenticatedDelete: boolean
  serviceRoleSelect: boolean
  expectedExposure: "locked_down" | "public_read_only"
  status: "ok" | "review" | "missing"
}

type ProfitabilityReportingViewRow = {
  flow_type: ProfitabilityReportingRow["flowType"]
  order_id: string
  trace_id: string
  service_category: string
  service_reference: string
  customer_reference: string
  recipient_label: string
  customer_name: string | null
  customer_email: string | null
  status: string
  currency: string
  input_amount: number | string | null
  provider_cost: number | string | null
  customer_price: number | string | null
  net_margin: number | string | null
  net_margin_percent: number | string | null
  gross_margin: number | string | null
  gross_margin_percent: number | string | null
  operating_cost: number | string | null
  net_margin_after_fees: number | string | null
  payment_method: string | null
  user_country_code: string | null
  ai_location_cluster: string | null
  ai_profile_source: "static" | "learned" | null
  provider: string | null
  pricing_strategy: string | null
  pricing_decision: PricingDecision | null
  failure_reason: string | null
  realized_at: string | null
  created_at: string
  updated_at: string
  realized: boolean
}

type SecurityDiagnosticsViewRow = {
  table_name: string
  classification: SecurityDiagnosticsRow["classification"]
  exists_in_schema: boolean
  row_security_enabled: boolean
  policy_count: number | string
  anon_select: boolean
  anon_insert: boolean
  anon_update: boolean
  anon_delete: boolean
  authenticated_select: boolean
  authenticated_insert: boolean
  authenticated_update: boolean
  authenticated_delete: boolean
  service_role_select: boolean
  expected_exposure: SecurityDiagnosticsRow["expectedExposure"]
  status: SecurityDiagnosticsRow["status"]
}

function toNumericOrNull(value: number | null | undefined) {
  return typeof value === "number" ? value : null
}

function parseNumeric(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function mapJitOrderToRow(order: JitOrder): JitOrderRow {
  const aiOptimization = order.pricingDecision?.aiOptimization

  return {
    id: order.id,
    trace_id: order.traceId,
    product_id: order.productId,
    product_type: order.productType,
    customer_reference: order.customerReference,
    recipient_label: order.recipientLabel,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    quoted_price: toNumericOrNull(order.quotedPrice),
    provider_cost: toNumericOrNull(order.providerCost),
    margin: toNumericOrNull(order.afrisendiqMargin),
    pricing_input_amount: order.amount,
    pricing_provider_cost: toNumericOrNull(order.providerCost ?? order.pricingDecision?.providerCost),
    pricing_customer_price: toNumericOrNull(order.quotedPrice ?? order.pricingDecision?.customerPrice),
    pricing_margin: toNumericOrNull(order.afrisendiqMargin ?? order.pricingDecision?.netMarginAfterCosts),
    pricing_margin_percent: toNumericOrNull(order.pricingDecision?.netMarginAfterCostsPercent),
    pricing_gross_margin: toNumericOrNull(order.grossMargin ?? order.pricingDecision?.grossMargin),
    pricing_gross_margin_percent: toNumericOrNull(order.pricingDecision?.grossMarginPercent),
    pricing_operating_cost: toNumericOrNull(order.operatingCost ?? order.pricingDecision?.operatingCost),
    pricing_net_margin_after_fees: toNumericOrNull(order.netMarginAfterFees ?? order.pricingDecision?.netMarginAfterFees),
    pricing_payment_method: order.paymentMethod ?? aiOptimization?.paymentMethod ?? null,
    pricing_user_country_code: order.userCountryCode ?? aiOptimization?.userCountryCode ?? null,
    ai_location_cluster: aiOptimization?.locationCluster ?? null,
    ai_profile_source: aiOptimization?.locationProfileSource ?? null,
    selected_provider: order.selectedProvider ?? null,
    pricing_strategy: order.pricingStrategy ?? null,
    payment_intent_id: order.paymentIntentId ?? null,
    provider_reference: order.providerReference ?? null,
    failure_reason: order.failureReason ?? null,
    pricing_decision: order.pricingDecision ?? null,
    guard_result: order.guardResult ?? null,
    created_at: order.createdAt,
    updated_at: order.updatedAt
  }
}

export function mapRowToJitOrder(row: JitOrderRow): JitOrder {
  const pricingDecision = row.pricing_decision ?? undefined

  return {
    id: row.id,
    traceId: row.trace_id,
    productId: row.product_id,
    productType: row.product_type,
    customerReference: row.customer_reference,
    recipientLabel: row.recipient_label,
    amount: row.pricing_input_amount ?? row.amount,
    currency: row.currency,
    status: row.status,
    quotedPrice: row.pricing_customer_price ?? row.quoted_price ?? undefined,
    providerCost: row.pricing_provider_cost ?? row.provider_cost ?? undefined,
    afrisendiqMargin: row.pricing_margin ?? row.margin ?? undefined,
    grossMargin: row.pricing_gross_margin ?? pricingDecision?.grossMargin ?? undefined,
    operatingCost: row.pricing_operating_cost ?? pricingDecision?.operatingCost ?? undefined,
    netMarginAfterFees: row.pricing_net_margin_after_fees ?? pricingDecision?.netMarginAfterFees ?? undefined,
    paymentMethod: (row.pricing_payment_method as JitOrder["paymentMethod"]) ?? undefined,
    userCountryCode: row.pricing_user_country_code ?? pricingDecision?.aiOptimization?.userCountryCode ?? undefined,
    selectedProvider: row.selected_provider ?? undefined,
    pricingStrategy: row.pricing_strategy ?? undefined,
    paymentIntentId: row.payment_intent_id ?? undefined,
    providerReference: row.provider_reference ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    pricingDecision,
    guardResult: row.guard_result ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    transitions: []
  }
}

export function mapSettlementToRow(record: SettlementRecord): SettlementRow {
  const aiOptimization = record.pricingDecision?.aiOptimization

  return {
    order_id: record.orderId,
    trace_id: record.traceId,
    customer_paid: record.customerPaid,
    provider_cost: record.providerCost,
    margin: record.afrisendiqMargin,
    pricing_input_amount: record.inputAmount,
    pricing_provider_cost: record.providerCost,
    pricing_customer_price: record.customerPaid,
    pricing_margin: record.afrisendiqMargin,
    pricing_margin_percent: toNumericOrNull(record.marginPercent),
    pricing_gross_margin: record.grossMargin,
    pricing_gross_margin_percent: toNumericOrNull(record.grossMarginPercent),
    pricing_operating_cost: record.operatingCost,
    pricing_net_margin_after_fees: record.netMarginAfterFees,
    pricing_payment_method: record.paymentMethod ?? aiOptimization?.paymentMethod ?? null,
    pricing_user_country_code: record.userCountryCode ?? aiOptimization?.userCountryCode ?? null,
    ai_location_cluster: aiOptimization?.locationCluster ?? null,
    ai_profile_source: aiOptimization?.locationProfileSource ?? null,
    currency: record.currency,
    provider: record.provider,
    pricing_strategy: record.pricingStrategy,
    pricing_decision: record.pricingDecision ?? null,
    settled_at: record.settledAt
  }
}

function mapProfitabilityRow(row: ProfitabilityReportingViewRow): ProfitabilityReportingRow {
  return {
    flowType: row.flow_type,
    orderId: row.order_id,
    traceId: row.trace_id,
    serviceCategory: row.service_category,
    serviceReference: row.service_reference,
    customerReference: row.customer_reference,
    recipientLabel: row.recipient_label,
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    status: row.status,
    currency: row.currency,
    inputAmount: parseNumeric(row.input_amount),
    providerCost: parseNumeric(row.provider_cost),
    customerPrice: parseNumeric(row.customer_price),
    netMargin: parseNumeric(row.net_margin),
    netMarginPercent: parseNumeric(row.net_margin_percent),
    grossMargin: parseNumeric(row.gross_margin),
    grossMarginPercent: parseNumeric(row.gross_margin_percent),
    operatingCost: parseNumeric(row.operating_cost),
    netMarginAfterFees: parseNumeric(row.net_margin_after_fees),
    paymentMethod: row.payment_method ?? row.pricing_decision?.aiOptimization?.paymentMethod ?? undefined,
    userCountryCode: row.user_country_code ?? row.pricing_decision?.aiOptimization?.userCountryCode ?? undefined,
    aiLocationCluster: row.ai_location_cluster ?? row.pricing_decision?.aiOptimization?.locationCluster ?? undefined,
    aiProfileSource: row.ai_profile_source ?? row.pricing_decision?.aiOptimization?.locationProfileSource ?? undefined,
    provider: row.provider ?? undefined,
    pricingStrategy: row.pricing_strategy ?? undefined,
    pricingDecision: row.pricing_decision ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    realizedAt: row.realized_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    realized: row.realized
  }
}

function mapSecurityDiagnosticsRow(row: SecurityDiagnosticsViewRow): SecurityDiagnosticsRow {
  return {
    tableName: row.table_name,
    classification: row.classification,
    existsInSchema: row.exists_in_schema,
    rowSecurityEnabled: row.row_security_enabled,
    policyCount: parseNumeric(row.policy_count) ?? 0,
    anonSelect: row.anon_select,
    anonInsert: row.anon_insert,
    anonUpdate: row.anon_update,
    anonDelete: row.anon_delete,
    authenticatedSelect: row.authenticated_select,
    authenticatedInsert: row.authenticated_insert,
    authenticatedUpdate: row.authenticated_update,
    authenticatedDelete: row.authenticated_delete,
    serviceRoleSelect: row.service_role_select,
    expectedExposure: row.expected_exposure,
    status: row.status
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function persistJitOrder(order: JitOrder) {
  const supabase = getSupabase()
  const { error } = await supabase.from("jit_orders").upsert(mapJitOrderToRow(order), { onConflict: "id" })

  if (error) {
    console.error("[supabase] Failed to persist JIT order:", error.message)
  }

  return !error
}

export async function fetchJitOrder(orderId: string): Promise<JitOrder | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("jit_orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (error || !data) return null

  return mapRowToJitOrder(data as JitOrderRow)
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export async function persistSettlement(record: SettlementRecord) {
  const supabase = getSupabase()
  const { error } = await supabase.from("settlements").insert(mapSettlementToRow(record))

  if (error) {
    console.error("[supabase] Failed to persist settlement:", error.message)
  }

  return !error
}

export async function listProfitabilityReportingRows(limit = 200): Promise<ProfitabilityReportingRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("profitability_reporting")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) {
    if (error) {
      console.error("[supabase] Failed to list profitability reporting rows:", error.message)
    }

    return []
  }

  return (data as ProfitabilityReportingViewRow[]).map(mapProfitabilityRow)
}

export async function listSecurityDiagnosticsRows(): Promise<SecurityDiagnosticsRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("security_diagnostics")
    .select("*")
    .order("table_name", { ascending: true })

  if (error || !data) {
    if (error) {
      console.error("[supabase] Failed to list security diagnostics rows:", error.message)
    }

    return []
  }

  return (data as SecurityDiagnosticsViewRow[]).map(mapSecurityDiagnosticsRow)
}

// ---------------------------------------------------------------------------
// Guard audit trail
// ---------------------------------------------------------------------------

export async function persistGuardAudit(
  traceId: string,
  verdicts: Array<{ guard: string; passed: boolean; reason?: string }>
) {
  const supabase = getSupabase()
  const rows = verdicts.map((v) => ({
    trace_id: traceId,
    guard: v.guard,
    passed: v.passed,
    reason: v.reason ?? null
  }))

  const { error } = await supabase.from("guard_audit").insert(rows)

  if (error) {
    console.error("[supabase] Failed to persist guard audit:", error.message)
  }

  return !error
}

// ---------------------------------------------------------------------------
// Webhook event idempotency
// ---------------------------------------------------------------------------

export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("webhook_events")
    .select("processed")
    .eq("id", eventId)
    .single()

  return data?.processed === true
}

export async function markWebhookProcessed(eventId: string, type: string, payload?: unknown) {
  const supabase = getSupabase()
  const { error } = await supabase.from("webhook_events").upsert(
    {
      id: eventId,
      type,
      processed: true,
      payload: payload ?? null
    },
    { onConflict: "id" }
  )

  if (error) {
    console.error("[supabase] Failed to mark webhook processed:", error.message)
  }
}
