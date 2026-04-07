import { NextResponse } from "next/server"
import { sendTwilioSmsMessage } from "@/app/lib/whatsapp"

function resolveTwilioTestSenderId(rawFrom?: string) {
  const explicitFrom = typeof rawFrom === "string" ? rawFrom.trim() : ""
  if (explicitFrom) {
    return explicitFrom
  }

  const configuredSoutraliSenderId = String(process.env.TWILIO_SOUTRALI_SMS_SENDER_ID || "").trim()
  return configuredSoutraliSenderId || undefined
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
  }

  try {
    const body = await request.json()
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const from = resolveTwilioTestSenderId(typeof body.from === "string" ? body.from : undefined)

    if (phone.length < 8) {
      return NextResponse.json({ success: false, error: "A valid SMS phone number is required." }, { status: 400 })
    }

    if (message.length < 4) {
      return NextResponse.json({ success: false, error: "Test message must be at least 4 characters." }, { status: 400 })
    }

    const result = await sendTwilioSmsMessage({
      to: phone,
      body: message,
      from,
    })

    return NextResponse.json({
      success: true,
      sid: result.sid,
      to: result.to,
      from: result.from,
      status: result.status,
      body: message,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to send test SMS",
    }, { status: 500 })
  }
}