import { processProviderCatalogCheckout } from "@/app/lib/providerCatalogCheckout"

export async function POST(request: Request) {
  const body = await request.json()
  const result = await processProviderCatalogCheckout(body)
  return Response.json(result.body, { status: result.status })
}