import * as manualBilling from "@/app/lib/manualBilling"
import { createInternalUnauthorizedResponse, isAuthorizedInternalRequest } from "@/app/lib/internalAuth"

type RouteContext = {
  params: Promise<{ orderId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  if (process.env.NODE_ENV === "production" && !isAuthorizedInternalRequest(request)) {
    return createInternalUnauthorizedResponse(true)
  }

  const { orderId } = await context.params
  const body = await request.json()
  const action = String(body.action || "").trim()
  const adminExecutionNotes = String(body.adminExecutionNotes || "").trim()
  const fulfillment = typeof body.fulfillment === "object" && body.fulfillment !== null
    ? {
        customerPhone: String(body.fulfillment.customerPhone || "").trim() || undefined,
        token: String(body.fulfillment.token || "").trim() || undefined,
        units: String(body.fulfillment.units || "").trim() || undefined,
        receiptReference: String(body.fulfillment.receiptReference || "").trim() || undefined,
        note: String(body.fulfillment.note || "").trim() || undefined,
      }
    : undefined

  if (action !== "start" && action !== "confirm" && action !== "complete") {
    return Response.json({ success: false, error: "Valid operator action is required" }, { status: 400 })
  }

  const order = await manualBilling.advanceManualOrderOperatorState(orderId, action, {
    source: "admin",
    adminExecutionNotes: adminExecutionNotes || undefined,
    fulfillment
  })

  return Response.json({ success: true, order })
}