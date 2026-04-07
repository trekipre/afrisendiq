import { getSupabase } from "@/app/lib/supabase"
import type { SoutraliTrackedOrder } from "@/app/lib/soutraliTrackedOrderState"

type SoutraliTrackedOrderRow = {
  id: string
  trace_id: string
  product_id: string
  product_name: string
  category: string
  brand: string
  amount: number
  quoted_price: number
  currency: string
  customer_reference: string
  recipient_label: string
  sender_name: string | null
  beneficiary_phone_number: string | null
  recipient_email: string | null
  payment_session_id: string | null
  payment_status: string | null
  selected_provider: string
  selected_execution_mode: string
  provider_external_id: string | null
  provider_status: string | null
  recharge_code: string | null
  failure_reason: string | null
  return_path: string
  status: string
  created_at: string
  updated_at: string
}

function mapRowToOrder(row: SoutraliTrackedOrderRow): SoutraliTrackedOrder {
  return {
    id: row.id,
    traceId: row.trace_id,
    productId: row.product_id,
    productName: row.product_name,
    category: row.category as SoutraliTrackedOrder["category"],
    brand: row.brand as SoutraliTrackedOrder["brand"],
    amount: row.amount,
    quotedPrice: row.quoted_price,
    currency: row.currency as "XOF",
    customerReference: row.customer_reference,
    recipientLabel: row.recipient_label,
    senderName: row.sender_name ?? undefined,
    beneficiaryPhoneNumber: row.beneficiary_phone_number ?? undefined,
    recipientEmail: row.recipient_email ?? undefined,
    paymentSessionId: row.payment_session_id ?? undefined,
    paymentStatus: (row.payment_status as SoutraliTrackedOrder["paymentStatus"]) ?? undefined,
    selectedProvider: row.selected_provider as SoutraliTrackedOrder["selectedProvider"],
    selectedExecutionMode: row.selected_execution_mode as SoutraliTrackedOrder["selectedExecutionMode"],
    providerExternalId: row.provider_external_id ?? undefined,
    providerStatus: row.provider_status ?? undefined,
    rechargeCode: row.recharge_code ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    returnPath: row.return_path,
    status: row.status as SoutraliTrackedOrder["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOrderToRow(order: SoutraliTrackedOrder): SoutraliTrackedOrderRow {
  return {
    id: order.id,
    trace_id: order.traceId,
    product_id: order.productId,
    product_name: order.productName,
    category: order.category,
    brand: order.brand,
    amount: order.amount,
    quoted_price: order.quotedPrice,
    currency: order.currency,
    customer_reference: order.customerReference,
    recipient_label: order.recipientLabel,
    sender_name: order.senderName ?? null,
    beneficiary_phone_number: order.beneficiaryPhoneNumber ?? null,
    recipient_email: order.recipientEmail ?? null,
    payment_session_id: order.paymentSessionId ?? null,
    payment_status: order.paymentStatus ?? null,
    selected_provider: order.selectedProvider,
    selected_execution_mode: order.selectedExecutionMode,
    provider_external_id: order.providerExternalId ?? null,
    provider_status: order.providerStatus ?? null,
    recharge_code: order.rechargeCode ?? null,
    failure_reason: order.failureReason ?? null,
    return_path: order.returnPath,
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  }
}

export async function persistSoutraliTrackedOrder(order: SoutraliTrackedOrder) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from("soutrali_tracked_orders")
    .upsert(mapOrderToRow(order), { onConflict: "id" })

  if (error) {
    console.error("[supabase] Failed to persist Soutrali tracked order:", error.message)
  }

  return !error
}

export async function fetchSoutraliTrackedOrder(orderId: string): Promise<SoutraliTrackedOrder | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("soutrali_tracked_orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (error || !data) {
    return null
  }

  return mapRowToOrder(data as SoutraliTrackedOrderRow)
}