import { NextResponse } from "next/server"
import { getTwilioWhatsAppStatusCallbackUrl, sendTwilioWhatsAppMessage } from "@/app/lib/whatsapp"

function getConfiguredWhatsAppTemplateConfig() {
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_TEST_CONTENT_SID
      || process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID
      || ""
    ).trim() || undefined,
    messagingServiceSid: String(
      process.env.TWILIO_WHATSAPP_TEST_MESSAGING_SERVICE_SID
      || process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID
      || ""
    ).trim() || undefined,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (phone.length < 8) {
      return NextResponse.json({ success: false, error: "A valid WhatsApp phone number is required." }, { status: 400 })
    }

    if (message.length < 4) {
      return NextResponse.json({ success: false, error: "Test message must be at least 4 characters." }, { status: 400 })
    }

    const templateConfig = getConfiguredWhatsAppTemplateConfig()
    const statusCallback = getTwilioWhatsAppStatusCallbackUrl()

    if (process.env.NODE_ENV === "production" && !templateConfig.contentSid) {
      return NextResponse.json({
        success: false,
        error: "TWILIO_WHATSAPP_TEST_CONTENT_SID or TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID must be configured for production WhatsApp test sends.",
      }, { status: 503 })
    }

    const result = templateConfig.contentSid
      ? await sendTwilioWhatsAppMessage({
          to: phone,
          contentSid: templateConfig.contentSid,
          contentVariables: { "1": message },
          ...(templateConfig.messagingServiceSid ? { messagingServiceSid: templateConfig.messagingServiceSid } : {}),
          ...(statusCallback ? { statusCallback } : {}),
        })
      : await sendTwilioWhatsAppMessage({
          to: phone,
          body: message,
          ...(statusCallback ? { statusCallback } : {}),
        })

    return NextResponse.json({
      success: true,
      sid: result.sid,
      to: result.to,
      from: result.from,
      whatsappHref: result.whatsappHref,
      templateSid: templateConfig.contentSid,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to send test WhatsApp message"
    }, { status: 500 })
  }
}