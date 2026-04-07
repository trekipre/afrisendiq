import { getDtOneServiceCatalog, getSupportedDtOneServices, type DtOneServiceType } from "@/app/lib/dtoneCatalog"

type CheckoutBody = {
  service?: string
  productId?: string
  customerReference?: string
  recipientLabel?: string
  amount?: number
}

function isServiceType(value: string): value is DtOneServiceType {
  return getSupportedDtOneServices().includes(value as DtOneServiceType)
}

export async function POST(request: Request) {
  const body = await request.json() as CheckoutBody
  const service = String(body.service || "")
  const productId = String(body.productId || "").trim()
  const customerReference = String(body.customerReference || "").trim()
  const recipientLabel = String(body.recipientLabel || "").trim()
  const requestedAmount = Number(body.amount)

  if (!service || !isServiceType(service)) {
    return Response.json({ success: false, error: "A valid service is required." }, { status: 400 })
  }

  if (!productId) {
    return Response.json({ success: false, error: "Choose a product before checkout." }, { status: 400 })
  }

  if (!customerReference) {
    return Response.json({ success: false, error: "Customer reference is required." }, { status: 400 })
  }

  if (!recipientLabel) {
    return Response.json({ success: false, error: "Recipient information is required." }, { status: 400 })
  }

  const catalog = await getDtOneServiceCatalog(service)

  if (!catalog.available) {
    return Response.json(
      { success: false, error: catalog.reason || "This DT One service is not available." },
      { status: 409 }
    )
  }

  const product = catalog.products.find((item) => item.id === productId)

  if (!product) {
    return Response.json({ success: false, error: "The selected product is no longer available." }, { status: 404 })
  }

  const amount = Number.isFinite(requestedAmount) && requestedAmount > 0
    ? requestedAmount
    : product.minAmount ?? product.maxAmount ?? 0

  if (product.minAmount !== null && amount < product.minAmount) {
    return Response.json({ success: false, error: `Amount must be at least ${product.minAmount} ${product.currency}` }, { status: 400 })
  }

  if (product.maxAmount !== null && amount > product.maxAmount) {
    return Response.json({ success: false, error: `Amount must not exceed ${product.maxAmount} ${product.currency}` }, { status: 400 })
  }

  const checkoutReference = `DTONE-${Date.now()}`

  return Response.json({
    success: true,
    checkoutReference,
    service,
    product,
    checkout: {
      customerReference,
      recipientLabel,
      amount,
      currency: product.currency || "N/A",
      status: "validated"
    }
  })
}