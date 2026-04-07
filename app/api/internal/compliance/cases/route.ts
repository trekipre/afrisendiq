import { listComplianceCases } from "@/app/lib/complianceSupabase"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const status = url.searchParams.get("status") || undefined

  return Response.json({
    success: true,
    cases: await listComplianceCases(status),
  })
}