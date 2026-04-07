import { getUsdRates } from "@/app/lib/fx"

export async function GET() {
  const rates = await getUsdRates()
  return Response.json(rates)
}