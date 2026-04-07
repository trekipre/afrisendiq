import { recordManualOrderOrangeFallbackStatus } from "@/app/lib/manualBilling"

type OrangeDeliveryReceiptPayload = {
  deliveryInfoNotification?: {
    callbackData?: string
    deliveryInfo?: {
      address?: string
      deliveryStatus?: string
    }
  }
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as OrangeDeliveryReceiptPayload | null
  const resourceId = payload?.deliveryInfoNotification?.callbackData
  const deliveryStatus = payload?.deliveryInfoNotification?.deliveryInfo?.deliveryStatus

  if (!resourceId) {
    return Response.json({ success: false, error: "Orange callbackData resource id is required." }, { status: 400 })
  }

  await recordManualOrderOrangeFallbackStatus({
    resourceId,
    status: deliveryStatus,
    payload: payload ? payload as unknown as Record<string, unknown> : undefined,
  })

  return Response.json({ success: true })
}