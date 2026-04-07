import { getSupabase } from "@/app/lib/supabase"
import type { CanonicalWebhookEnvelope } from "@/app/lib/services/webhookService"

export async function recordInboundWebhookEvent(envelope: CanonicalWebhookEnvelope) {
  const supabase = getSupabase()
  const { error } = await supabase.from("inbound_webhook_events").upsert(
    {
      provider: envelope.provider,
      provider_event_id: envelope.eventId,
      signature_valid: true,
      event_type: envelope.eventType,
      domain_type: envelope.domainType,
      domain_reference: envelope.domainReference ?? null,
      order_id: envelope.orderId ?? null,
      payload: envelope.payload,
    },
    { onConflict: "provider,provider_event_id" }
  )

  if (error) {
    console.error("[supabase] Failed to record inbound webhook event:", error.message)
  }

  return !error
}