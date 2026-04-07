import { NextResponse } from "next/server"
import twilio from "twilio"
import { recordManualOrderTwilioSmsFallbackStatus, recordManualOrderWhatsAppStatus } from "@/app/lib/manualBilling"
import { buildTwilioWebhookUrl, parseTwilioWebhookPayload } from "@/app/lib/twilioWebhook"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const payload = parseTwilioWebhookPayload(new URLSearchParams(rawBody))
  const signature = request.headers.get("x-twilio-signature")
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const messageSid = payload.MessageSid || payload.SmsSid

  if (!messageSid) {
    return NextResponse.json({ success: false, error: "Twilio MessageSid is required." }, { status: 400 })
  }

  const signatureValid = Boolean(
    signature && authToken && twilio.validateRequest(authToken, signature, buildTwilioWebhookUrl(request), payload)
  )

  if (!signatureValid) {
    return NextResponse.json({ success: false, error: "Signature validation failed." }, { status: 403 })
  }

  if (String(payload.To || "").startsWith("whatsapp:")) {
    await recordManualOrderWhatsAppStatus({
      messageSid,
      status: payload.MessageStatus,
      payload,
    })
  } else {
    await recordManualOrderTwilioSmsFallbackStatus({
      messageSid,
      status: payload.MessageStatus,
      payload,
    })
  }

  return NextResponse.json({ success: true })
}