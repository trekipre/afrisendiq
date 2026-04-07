import { NextResponse } from "next/server"
import { sendTpeCloudSmsMessage } from "@/app/lib/tpeCloudSms"

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const from = parseOptionalString(body.from)
    const senderId = parseOptionalString(body.senderId)

    if (phone.length < 8) {
      return NextResponse.json({ success: false, error: "A valid SMS phone number is required." }, { status: 400 })
    }

    if (message.length < 4) {
      return NextResponse.json({ success: false, error: "Test message must be at least 4 characters." }, { status: 400 })
    }

    const result = await sendTpeCloudSmsMessage({
      to: phone,
      message,
      from,
      senderId,
    })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      to: result.to,
      from: result.from,
      senderId: result.senderId,
      status: result.status,
      summaryMessage: result.summaryMessage,
      body: message,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to send TPECloud test SMS",
    }, { status: 500 })
  }
}