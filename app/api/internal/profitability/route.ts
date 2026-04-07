import { getManualBillingAlertSettings } from "@/app/lib/internalSettings"
import { listProfitabilityReportingRows } from "@/app/lib/supabaseOrders"

function sumNumbers(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => {
    return total + (typeof value === "number" ? value : 0)
  }, 0)
}

export async function GET() {
  const rows = await listProfitabilityReportingRows(250)
  const settings = await getManualBillingAlertSettings()
  const realizedRows = rows.filter((row) => row.realized)

  return Response.json({
    success: true,
    rows,
    settings: {
      stuckPaidThresholdMinutes: settings.stuckPaidThresholdMinutes,
      updatedAt: settings.updatedAt,
      source: settings.source,
    },
    summary: {
      totalOrders: rows.length,
      realizedOrders: realizedRows.length,
      jitOrders: rows.filter((row) => row.flowType === "jit").length,
      manualBillingOrders: rows.filter((row) => row.flowType === "manual_billing").length,
      realizedNetMargin: sumNumbers(realizedRows.map((row) => row.netMargin)),
      expectedNetMargin: sumNumbers(rows.map((row) => row.netMargin)),
      realizedGrossMargin: sumNumbers(realizedRows.map((row) => row.grossMargin)),
      totalOperatingCost: sumNumbers(rows.map((row) => row.operatingCost)),
    },
  })
}