import { processAirtimePurchase } from "@/app/lib/airtimePurchase"


export async function POST(req: Request) {
  const body = await req.json()
  const result = await processAirtimePurchase(body)
  return Response.json(result.body, { status: result.status })
}