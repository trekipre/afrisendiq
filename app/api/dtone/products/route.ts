import { getDTOneProducts } from "../../../lib/dtone"

export async function GET() {

  const products = await getDTOneProducts()

  return Response.json(products)

}