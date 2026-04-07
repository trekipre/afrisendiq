import { presentManualOrder, resendManualOrderSmsDelivery } from "@/app/lib/manualBilling"

type RouteContext = {
  params: Promise<{ orderId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { orderId } = await context.params

  try {
    const order = await resendManualOrderSmsDelivery(orderId)
    return Response.json({ success: true, order: presentManualOrder(order) })
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to resend SMS delivery" },
      { status: 400 }
    )
  }
}