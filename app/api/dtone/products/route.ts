import { getDTOneProducts } from "../../../lib/dtone"

export async function GET() {
  try {
    const products = await getDTOneProducts()
    return Response.json(products)
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load DT One products"
      },
      { status: 503 }
    )
  }
}