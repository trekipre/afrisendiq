import { getCieReadinessReport } from "@/app/lib/liveReadiness"

export async function GET() {
  const report = await getCieReadinessReport()
  return Response.json({ success: true, report })
}