import { createSoutraliTrackedCheckoutSession } from "@/app/lib/soutraliTrackedPayments"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    productId?: string
    customerReference?: string
    recipientLabel?: string
    beneficiaryPhoneNumber?: string
    recipientEmail?: string
    amount?: number
    returnPath?: string
    senderName?: string
  }

  if (!String(body.productId || "").trim()) {
    return Response.json({ success: false, error: "Soutrali product is required" }, { status: 400 })
  }

  if (!String(body.customerReference || "").trim()) {
    return Response.json({ success: false, error: "Customer reference is required" }, { status: 400 })
  }

  if (!String(body.recipientLabel || "").trim()) {
    return Response.json({ success: false, error: "Recipient label is required" }, { status: 400 })
  }

  try {
    const result = await createSoutraliTrackedCheckoutSession({
      productId: String(body.productId).trim(),
      customerReference: String(body.customerReference).trim(),
      recipientLabel: String(body.recipientLabel).trim(),
      senderName: String(body.senderName || "").trim() || undefined,
      beneficiaryPhoneNumber: String(body.beneficiaryPhoneNumber || "").trim() || undefined,
      recipientEmail: String(body.recipientEmail || "").trim() || undefined,
      amount: Number(body.amount),
      returnPath: String(body.returnPath || "").trim() || undefined,
    })

    return Response.json({
      success: true,
      orderId: result.orderId,
      checkoutUrl: result.checkoutUrl,
      quotedPrice: result.quotedPrice,
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to create Soutrali checkout session",
      },
      { status: 400 }
    )
  }
}