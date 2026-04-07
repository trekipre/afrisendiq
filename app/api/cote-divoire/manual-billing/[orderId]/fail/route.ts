import { failManualOrder } from "@/app/lib/manualBilling"

type RouteContext = {
  params: Promise<{ orderId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { orderId } = await context.params
  const body = await request.json()
  const failureReason = String(body.failureReason || "").trim()
  const adminExecutionNotes = String(body.adminExecutionNotes || "").trim()

  if (!failureReason) {
    return Response.json({ success: false, error: "failureReason is required" }, { status: 400 })
  }

  const order = await failManualOrder({
    orderId,
    failureReason,
    adminExecutionNotes: adminExecutionNotes || undefined
  })

  return Response.json({ success: true, order })
}