import { createManualOrder, getAllManualOrders, presentManualOrder, presentManualOrders } from "@/app/lib/manualBilling"
import { getManualBillingAlertSettings } from "@/app/lib/internalSettings"

export async function GET() {
  const orders = await getAllManualOrders()
  const settings = await getManualBillingAlertSettings()

  return Response.json({
    success: true,
    orders: presentManualOrders(orders),
    settings: {
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

  const service = String(body.service || "").trim()
  const accountReference = String(body.accountReference || "").trim()
  const customerName = String(body.customerName || "").trim()
  const customerEmail = String(body.customerEmail || "").trim()
  const customerPhone = String(body.customerPhone || "").trim()
  const recipientName = String(body.recipientName || "").trim()
  const packageCode = String(body.packageCode || "").trim()
  const packageLabel = String(body.packageLabel || "").trim()

  if (!service || !accountReference || !customerName || !customerEmail || !recipientName) {
    return Response.json(
      { success: false, error: "Missing required manual billing fields" },
      { status: 400 }
    )
  }

  try {
    const order = await createManualOrder({
      service: service as "sodeci" | "cie-postpaid" | "cie-prepaid" | "canal-plus",
      accountReference,
      packageCode: packageCode || undefined,
      packageLabel: packageLabel || undefined,
      customerName,
      customerEmail,
      customerPhone: customerPhone || undefined,
      recipientName,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : undefined
    })

    return Response.json({ success: true, order: presentManualOrder(order) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create manual billing order"
    return Response.json({ success: false, error: message }, { status: 400 })
  }
}