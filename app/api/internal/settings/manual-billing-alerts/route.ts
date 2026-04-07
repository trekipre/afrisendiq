import { updateManualBillingAlertSettings, getManualBillingAlertSettings, parseManualBillingSmsRoutingPolicy } from "@/app/lib/internalSettings"

function parseThresholdMinutes(rawValue: unknown) {
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null
  }

  return Math.floor(parsedValue)
}

export async function GET() {
  const settings = await getManualBillingAlertSettings()

  return Response.json({
    success: true,
    setting: {
      quoteRequestedThresholdMinutes: settings.quoteRequestedThresholdMinutes,
      stuckPaidThresholdMinutes: settings.stuckPaidThresholdMinutes,
      whatsappFallbackDelayMinutes: settings.whatsappFallbackDelayMinutes,
      twilioSmsFallbackEnabled: settings.twilioSmsFallbackEnabled,
      orangeFallbackEnabled: settings.orangeFallbackEnabled,
      mtnFallbackEnabled: settings.mtnFallbackEnabled,
      africasTalkingFallbackEnabled: settings.africasTalkingFallbackEnabled,
      tpeCloudFallbackEnabled: settings.tpeCloudFallbackEnabled,
      routingPolicy: settings.routingPolicy,
      updatedAt: settings.updatedAt,
      source: settings.source
    }
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  const quoteRequestedThresholdMinutes = parseThresholdMinutes(body?.quoteRequestedThresholdMinutes)
  const thresholdMinutes = parseThresholdMinutes(body?.stuckPaidThresholdMinutes)
  const fallbackDelayMinutes = body?.whatsappFallbackDelayMinutes === undefined ? undefined : parseThresholdMinutes(body?.whatsappFallbackDelayMinutes)
  const twilioSmsFallbackEnabled = body?.twilioSmsFallbackEnabled
  const orangeFallbackEnabled = body?.orangeFallbackEnabled
  const mtnFallbackEnabled = body?.mtnFallbackEnabled
  const africasTalkingFallbackEnabled = body?.africasTalkingFallbackEnabled
  const tpeCloudFallbackEnabled = body?.tpeCloudFallbackEnabled
  const routingPolicy = body?.routingPolicy === undefined ? undefined : parseManualBillingSmsRoutingPolicy(body?.routingPolicy)

  if ((body?.quoteRequestedThresholdMinutes !== undefined && quoteRequestedThresholdMinutes === null) || (body?.stuckPaidThresholdMinutes !== undefined && thresholdMinutes === null) || (body?.whatsappFallbackDelayMinutes !== undefined && fallbackDelayMinutes === null)) {
    return Response.json(
      {
        success: false,
        error: "Threshold values must be positive numbers"
      },
      { status: 400 }
    )
  }

  if (twilioSmsFallbackEnabled !== undefined && typeof twilioSmsFallbackEnabled !== "boolean") {
    return Response.json(
      {
        success: false,
        error: "twilioSmsFallbackEnabled must be a boolean when provided"
      },
      { status: 400 }
    )
  }

  if (orangeFallbackEnabled !== undefined && typeof orangeFallbackEnabled !== "boolean") {
    return Response.json(
      {
        success: false,
        error: "orangeFallbackEnabled must be a boolean when provided"
      },
      { status: 400 }
    )
  }

  if (mtnFallbackEnabled !== undefined && typeof mtnFallbackEnabled !== "boolean") {
    return Response.json(
      {
        success: false,
        error: "mtnFallbackEnabled must be a boolean when provided"
      },
      { status: 400 }
    )
  }

  if (africasTalkingFallbackEnabled !== undefined && typeof africasTalkingFallbackEnabled !== "boolean") {
    return Response.json(
      {
        success: false,
        error: "africasTalkingFallbackEnabled must be a boolean when provided"
      },
      { status: 400 }
    )
  }

  if (tpeCloudFallbackEnabled !== undefined && typeof tpeCloudFallbackEnabled !== "boolean") {
    return Response.json(
      {
        success: false,
        error: "tpeCloudFallbackEnabled must be a boolean when provided"
      },
      { status: 400 }
    )
  }

  if (body?.routingPolicy !== undefined && !routingPolicy) {
    return Response.json(
      {
        success: false,
        error: "routingPolicy must contain valid provider arrays for each configured route"
      },
      { status: 400 }
    )
  }

  const settings = await updateManualBillingAlertSettings({
    quoteRequestedThresholdMinutes: quoteRequestedThresholdMinutes ?? undefined,
    stuckPaidThresholdMinutes: thresholdMinutes ?? undefined,
    whatsappFallbackDelayMinutes: fallbackDelayMinutes ?? undefined,
    twilioSmsFallbackEnabled: typeof twilioSmsFallbackEnabled === "boolean" ? twilioSmsFallbackEnabled : undefined,
    orangeFallbackEnabled: typeof orangeFallbackEnabled === "boolean" ? orangeFallbackEnabled : undefined,
    mtnFallbackEnabled: typeof mtnFallbackEnabled === "boolean" ? mtnFallbackEnabled : undefined,
    africasTalkingFallbackEnabled: typeof africasTalkingFallbackEnabled === "boolean" ? africasTalkingFallbackEnabled : undefined,
    tpeCloudFallbackEnabled: typeof tpeCloudFallbackEnabled === "boolean" ? tpeCloudFallbackEnabled : undefined,
    routingPolicy: routingPolicy ?? undefined,
  })

  return Response.json({
    success: true,
    setting: {
      quoteRequestedThresholdMinutes: settings.quoteRequestedThresholdMinutes,
      stuckPaidThresholdMinutes: settings.stuckPaidThresholdMinutes,
      whatsappFallbackDelayMinutes: settings.whatsappFallbackDelayMinutes,
      twilioSmsFallbackEnabled: settings.twilioSmsFallbackEnabled,
      orangeFallbackEnabled: settings.orangeFallbackEnabled,
      mtnFallbackEnabled: settings.mtnFallbackEnabled,
      africasTalkingFallbackEnabled: settings.africasTalkingFallbackEnabled,
      tpeCloudFallbackEnabled: settings.tpeCloudFallbackEnabled,
      routingPolicy: settings.routingPolicy,
      updatedAt: settings.updatedAt,
      source: settings.source
    }
  })
}