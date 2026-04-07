import { recordManualOrderMtnFallbackStatus } from "@/app/lib/manualBilling"

type MtnDeliveryReceiptPayload = {
  deliveryInfoNotification?: {
    transactionId?: string
    deliveryInfo?: {
      requestId?: string
      clientCorrelator?: string
      deliveryStatus?: Array<{
        receiverAddress?: string
        status?: string
      }>
    }
  }
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as MtnDeliveryReceiptPayload | null
  const deliveryInfo = payload?.deliveryInfoNotification?.deliveryInfo
  const status = deliveryInfo?.deliveryStatus?.[0]?.status

  await recordManualOrderMtnFallbackStatus({
    requestId: deliveryInfo?.requestId,
    clientCorrelator: deliveryInfo?.clientCorrelator,
    transactionId: payload?.deliveryInfoNotification?.transactionId,
    status,
    payload: payload ? payload as unknown as Record<string, unknown> : undefined,
  })

  return Response.json({ success: true })
}