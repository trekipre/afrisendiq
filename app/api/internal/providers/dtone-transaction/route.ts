import { lookupDTOneTransactionByExternalId } from "@/app/lib/dtone"
import { assessDtOneTransactionStatus } from "@/app/lib/dtoneTransactionStatus"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const externalId = String(searchParams.get("externalId") || "").trim()

  if (!externalId) {
    return Response.json({ success: false, error: "externalId is required" }, { status: 400 })
  }

  try {
    const result = await lookupDTOneTransactionByExternalId(externalId)
    const transaction = result.transaction as Record<string, unknown>
    const statusAssessment = assessDtOneTransactionStatus(transaction)

    return Response.json({
      success: true,
      externalId,
      rechargeCode: result.rechargeCode ?? null,
      statusAssessment,
      transaction: result.transaction
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        externalId,
        error: error instanceof Error ? error.message : "DT One transaction lookup failed"
      },
      { status: 404 }
    )
  }
}