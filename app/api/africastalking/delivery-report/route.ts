import { recordManualOrderAfricasTalkingFallbackStatus } from "@/app/lib/manualBilling"
import { parseAfricasTalkingDeliveryReportPayload } from "@/app/lib/africasTalkingWebhook"
import { recordInboundWebhookEvent } from "@/app/lib/webhookEventSupabase"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const payload = parseAfricasTalkingDeliveryReportPayload(new URLSearchParams(rawBody))
  const messageId = payload.id

  if (!messageId) {
    return Response.json({ success: false, error: "Africa's Talking delivery report id is required." }, { status: 400 })
  }

  await recordInboundWebhookEvent({
    provider: "africastalking",
    eventId: messageId,
    eventType: payload.status ? `delivery_report.${payload.status}` : "delivery_report.unknown",
    domainType: "provider",
    domainReference: payload.phoneNumber ?? messageId,
    payload,
  })

  await recordManualOrderAfricasTalkingFallbackStatus({
    messageId,
    status: payload.status,
    payload: payload as unknown as Record<string, unknown>,
  })

  return Response.json({ success: true })
}