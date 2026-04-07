import { NextResponse } from "next/server"
import { sendAfricasTalkingSmsMessage } from "@/app/lib/africasTalkingSms"
import { buildOtpSmsMessage } from "@/app/lib/otpSms"

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function parseOptionalExpiryMinutes(value: unknown) {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("expiryMinutes must be a positive number")
  }

  return Math.floor(parsed)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const phone = typeof body?.phone === "string" ? body.phone.trim() : ""
    const code = typeof body?.code === "string" ? body.code.trim() : ""
    const brandName = parseOptionalString(body?.brandName)
    const purpose = parseOptionalString(body?.purpose)
    const supportUrl = parseOptionalString(body?.supportUrl)
    const expiryMinutes = parseOptionalExpiryMinutes(body?.expiryMinutes)

    if (phone.length < 8) {
      return NextResponse.json({ success: false, error: "A valid SMS phone number is required." }, { status: 400 })
    }

    if (code.length < 4) {
      return NextResponse.json({ success: false, error: "OTP code must be at least 4 characters." }, { status: 400 })
    }

    const message = buildOtpSmsMessage({
      code,
      brandName,
      expiryMinutes,
      purpose,
      supportUrl,
    })

    const result = await sendAfricasTalkingSmsMessage({
      to: phone,
      message,
    })

    return NextResponse.json({
      success: true,
      templateType: "otp",
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
    const message = error instanceof Error ? error.message : "Unable to send OTP SMS"
    const status = /positive number|alphanumeric/i.test(message) ? 400 : 500

    return NextResponse.json({
      success: false,
      error: message,
    }, { status })
  }
}