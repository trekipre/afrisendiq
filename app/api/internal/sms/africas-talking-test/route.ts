import { NextResponse } from "next/server"
import { sendAfricasTalkingSmsMessage } from "@/app/lib/africasTalkingSms"

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
  }

  try {
    const body = await request.json()
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (phone.length < 8) {
      return NextResponse.json({ success: false, error: "A valid SMS phone number is required." }, { status: 400 })
    }

    if (message.length < 4) {
      return NextResponse.json({ success: false, error: "Test message must be at least 4 characters." }, { status: 400 })
    }

    const result = await sendAfricasTalkingSmsMessage({
      to: phone,
      message,
    })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      to: result.to,
      senderId: result.senderId,
      status: result.status,
      statusCode: result.statusCode,
      cost: result.cost,
      summaryMessage: result.summaryMessage,
      body: message,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to send Africa's Talking test SMS",
    }, { status: 500 })
  }
}