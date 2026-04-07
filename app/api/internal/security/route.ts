import { listSecurityDiagnosticsRows } from "@/app/lib/supabaseOrders"

export async function GET() {
  const rows = await listSecurityDiagnosticsRows()

  return Response.json({
    success: true,
    generatedAt: new Date().toISOString(),
    rows,
    summary: {
      totalTables: rows.length,
      okTables: rows.filter((row) => row.status === "ok").length,
      reviewTables: rows.filter((row) => row.status === "review").length,
      missingTables: rows.filter((row) => row.status === "missing").length,
      sensitiveTables: rows.filter((row) => row.classification === "sensitive").length
    }
  })
}