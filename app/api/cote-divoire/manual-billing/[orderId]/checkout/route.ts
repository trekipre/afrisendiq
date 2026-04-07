import { createManualCheckoutSession } from "@/app/lib/manualBilling"

type RouteContext = {
  params: Promise<{ orderId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { orderId } = await context.params
  const result = await createManualCheckoutSession(orderId)
  return Response.json({ success: true, order: result.order, checkoutUrl: result.checkoutUrl })
}