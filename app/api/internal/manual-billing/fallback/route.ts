import { runManualBillingSmsFallbackEvaluation } from "@/app/lib/manualBilling"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "true"
  const limit = Number(url.searchParams.get("limit") || "")

  const result = await runManualBillingSmsFallbackEvaluation({
    dryRun,
    limit: Number.isFinite(limit) ? limit : undefined,
  })

  return Response.json({ success: true, ...result })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const limit = Number(body?.limit)

  const result = await runManualBillingSmsFallbackEvaluation({
    dryRun: Boolean(body?.dryRun),
    limit: Number.isFinite(limit) ? limit : undefined,
  })

  return Response.json({ success: true, ...result })
}