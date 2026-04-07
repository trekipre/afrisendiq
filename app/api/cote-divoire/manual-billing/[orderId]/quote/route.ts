import { setManualQuote } from "@/app/lib/manualBilling"

type RouteContext = {
  params: Promise<{ orderId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { orderId } = await context.params
  const body = await request.json()
  const quotedAmount = Number(body.quotedAmount)
  const adminQuoteNotes = String(body.adminQuoteNotes || "").trim()

  if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
    return Response.json({ success: false, error: "A valid quotedAmount is required" }, { status: 400 })
  }

  try {
    const order = await setManualQuote({
      orderId,
      quotedAmount,
      adminQuoteNotes: adminQuoteNotes || undefined
    })

    return Response.json({ success: true, order })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save quote"
    return Response.json({ success: false, error: message }, { status: 400 })
  }
}