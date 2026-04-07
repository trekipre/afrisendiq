import { NextResponse } from "next/server"
import twilio from "twilio"
import { persistTwilioInboundMessage } from "@/app/lib/twilioInbox"
import {
  buildTwilioWebhookUrl,
  collectTwilioMediaUrls,
  getTwilioInboundChannel,
  normalizeTwilioAddress,
  parseTwilioWebhookPayload,
} from "@/app/lib/twilioWebhook"

export const runtime = "nodejs"

function xmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/xml; charset=utf-8"
    }
  })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const payload = parseTwilioWebhookPayload(new URLSearchParams(rawBody))
  const signature = request.headers.get("x-twilio-signature")
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const providerMessageSid = payload.MessageSid || payload.SmsSid

  if (!providerMessageSid) {
    return NextResponse.json({ success: false, error: "Twilio MessageSid is required." }, { status: 400 })
  }

  const signatureValid = Boolean(
    signature && authToken && twilio.validateRequest(authToken, signature, buildTwilioWebhookUrl(request), payload)
  )

  if (!signatureValid) {
    return xmlResponse("<Response><Message>Signature validation failed.</Message></Response>", 403)
  }

  const channel = getTwilioInboundChannel(payload)

  await persistTwilioInboundMessage({
    providerMessageSid,
    accountSid: payload.AccountSid,
    messagingServiceSid: payload.MessagingServiceSid,
    channel,
    fromNumber: normalizeTwilioAddress(payload.From) || "unknown",
    toNumber: normalizeTwilioAddress(payload.To) || "unknown",
    body: payload.Body,
    profileName: payload.ProfileName,
    numMedia: Number(payload.NumMedia || "0") || 0,
    mediaUrls: collectTwilioMediaUrls(payload),
    rawPayload: payload,
    signatureValid,
  })

  return xmlResponse("<Response></Response>")
}