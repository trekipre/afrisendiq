import { lookupDTOneTransactionByExternalId } from "@/app/lib/dtone"
import { assessDtOneTransactionStatus } from "@/app/lib/dtoneTransactionStatus"

function normalizeErrorStatus(message: string) {
  if (message.includes("(429)")) {
    return 429
  }

  if (message.includes("not found") || message.includes("(404)")) {
    return 404
  }

  return 502
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const externalId = String(searchParams.get("externalId") || "").trim()

  if (!externalId) {
    return Response.json({ success: false, error: "externalId is required" }, { status: 400 })
  }

  try {
    const result = await lookupDTOneTransactionByExternalId(externalId)
    const transaction = result.transaction as Record<string, unknown>
    const statusRecord = transaction.status as Record<string, unknown> | undefined
    const statusAssessment = assessDtOneTransactionStatus(transaction)
    const customerStatus = result.rechargeCode
      ? "code_ready"
      : statusAssessment.phase === "failed" || statusAssessment.phase === "likely-stalled"
        ? "processing_issue"
        : "processing"

    return Response.json({
      success: true,
      externalId,
      rechargeCode: result.rechargeCode ?? null,
      customerStatus,
      transaction: {
        id: transaction.id ?? null,
        externalId: transaction.external_id ?? externalId,
        createdAt: transaction.creation_date ?? null,
        expiresAt: transaction.confirmation_expiration_date ?? null,
        statusLabel: customerStatus === "code_ready"
          ? "Code ready"
          : customerStatus === "processing_issue"
            ? "Processing issue"
            : "Processing"
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Soutrali transaction lookup failed"

    return Response.json(
      {
        success: false,
        externalId,
        error: message
      },
      { status: normalizeErrorStatus(message) }
    )
  }
}