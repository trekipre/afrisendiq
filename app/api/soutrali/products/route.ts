import { listSoutraliProducts, quoteSoutraliProduct } from "@/app/lib/soutraliEngine"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get("productId")
  const amount = Number(searchParams.get("amount"))
  const customerReference = searchParams.get("customerReference") || undefined
  const category = searchParams.get("category") as "airtime" | "data" | "electricity" | "gift-card" | undefined

  if (productId && Number.isFinite(amount) && amount > 0) {
    try {
      const quote = await quoteSoutraliProduct({
        productId,
        amount,
        customerReference
      })

      return Response.json({
        success: true,
        quote
      })
    } catch (error) {
      return Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unable to quote Soutrali product"
        },
        { status: 400 }
      )
    }
  }

  return Response.json({
    success: true,
    products: listSoutraliProducts(category || undefined)
  })
}