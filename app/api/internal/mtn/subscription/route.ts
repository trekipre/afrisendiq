import { NextResponse } from "next/server"
import { getMtnSmsConfig, isMtnSmsConfigured, subscribeMtnSmsDeliveryNotifications } from "@/app/lib/mtnSms"

function buildConfigPayload() {
  const config = getMtnSmsConfig()

  return {
    configured: isMtnSmsConfigured(),
    senderAddress: config.senderAddress || null,
    notifyUrl: config.notifyUrl || null,
    targetSystem: config.targetSystem,
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    config: buildConfigPayload(),
  })
}

export async function POST() {
  try {
    const result = await subscribeMtnSmsDeliveryNotifications()

    return NextResponse.json({
      success: true,
      config: buildConfigPayload(),
      subscription: result,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to create MTN delivery receipt subscription",
      config: buildConfigPayload(),
    }, { status: 500 })
  }
}