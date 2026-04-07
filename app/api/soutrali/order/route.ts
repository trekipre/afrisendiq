import { fetchSoutraliTrackedOrder } from "@/app/lib/soutraliTrackedOrderSupabase"
import {
  buildCustomerFacingSoutraliStatus,
  refreshSoutraliTrackedOrder,
} from "@/app/lib/soutraliTrackedPayments"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderId = String(searchParams.get("orderId") || "").trim()

  if (!orderId) {
    return Response.json({ success: false, error: "orderId is required" }, { status: 400 })
  }

  const existingOrder = await fetchSoutraliTrackedOrder(orderId)

  if (!existingOrder) {
    return Response.json({ success: false, error: "Order not found" }, { status: 404 })
  }

  const order = (await refreshSoutraliTrackedOrder(orderId)) || existingOrder
  const customerView = buildCustomerFacingSoutraliStatus(order)

  return Response.json({
    success: true,
    order: {
      id: order.id,
      productId: order.productId,
      productName: order.productName,
      category: order.category,
      brand: order.brand,
      amount: order.amount,
      quotedPrice: order.quotedPrice,
      currency: order.currency,
      customerReference: order.customerReference,
      recipientLabel: order.recipientLabel,
      beneficiaryPhoneNumber: order.beneficiaryPhoneNumber ?? null,
      recipientEmail: order.recipientEmail ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customerStatus: customerView.customerStatus,
      reference: customerView.reference,
      rechargeCode: customerView.rechargeCode,
      showReference: customerView.showReference,
    },
  })
}