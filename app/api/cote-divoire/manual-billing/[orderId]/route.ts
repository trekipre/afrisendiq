import { getManualOrder, presentManualOrder } from "@/app/lib/manualBilling"

type RouteContext = {
  params: Promise<{ orderId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params
  const order = await getManualOrder(orderId)

  if (!order) {
    return Response.json({ success: false, error: "Order not found" }, { status: 404 })
  }

  return Response.json({ success: true, order: presentManualOrder(order) })
}