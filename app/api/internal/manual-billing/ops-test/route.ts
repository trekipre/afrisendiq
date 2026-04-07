import { NextResponse } from "next/server"
import { runManualBillingOpsTestHook } from "@/app/lib/manualBilling"

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function parseOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined
}

function parseOverrideNow(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined
  }

  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("fallback.overrideNow must be a valid ISO timestamp")
  }

  return parsed
}

function parseOverrideDelayMinutes(value: unknown) {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("fallback.settingsOverride.whatsappFallbackDelayMinutes must be zero or a positive number")
  }

  return Math.floor(parsed)
}

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_OPS_TEST_SECRET?.trim()

  if (!expectedSecret) {
    return NextResponse.json({ success: false, error: "INTERNAL_OPS_TEST_SECRET is not configured" }, { status: 503 })
  }

  const providedSecret = request.headers.get("x-internal-ops-test-secret")?.trim()
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const createOrder = typeof body?.createOrder === "object" && body.createOrder !== null
      ? {
          service: String(body.createOrder.service || "").trim() as "sodeci" | "cie-postpaid" | "cie-prepaid" | "canal-plus",
          accountReference: String(body.createOrder.accountReference || "").trim(),
          packageCode: parseOptionalString(body.createOrder.packageCode),
          packageLabel: parseOptionalString(body.createOrder.packageLabel),
          customerName: String(body.createOrder.customerName || "").trim(),
          customerEmail: String(body.createOrder.customerEmail || "").trim(),
          customerPhone: parseOptionalString(body.createOrder.customerPhone),
          recipientName: String(body.createOrder.recipientName || "").trim(),
          metadata: typeof body.createOrder.metadata === "object" && body.createOrder.metadata !== null
            ? body.createOrder.metadata as Record<string, unknown>
            : undefined,
        }
      : undefined

    const result = await runManualBillingOpsTestHook({
      orderId: parseOptionalString(body?.orderId),
      createOrder,
      quotedAmount: typeof body?.quotedAmount === "number" ? body.quotedAmount : undefined,
      createCheckoutSession: parseOptionalBoolean(body?.createCheckoutSession),
      markPaid: parseOptionalBoolean(body?.markPaid),
      paymentSessionId: parseOptionalString(body?.paymentSessionId),
      autoProgress: parseOptionalBoolean(body?.autoProgress),
      fulfillment: typeof body?.fulfillment === "object" && body.fulfillment !== null
        ? {
            customerPhone: parseOptionalString(body.fulfillment.customerPhone),
            token: parseOptionalString(body.fulfillment.token),
            units: parseOptionalString(body.fulfillment.units),
            receiptReference: parseOptionalString(body.fulfillment.receiptReference),
            note: parseOptionalString(body.fulfillment.note),
          }
        : undefined,
      fallback: typeof body?.fallback === "object" && body.fallback !== null
        ? {
            dryRun: parseOptionalBoolean(body.fallback.dryRun),
            limit: typeof body.fallback.limit === "number" && Number.isFinite(body.fallback.limit) ? Math.floor(body.fallback.limit) : undefined,
            overrideNow: parseOverrideNow(body.fallback.overrideNow),
            settingsOverride: typeof body.fallback.settingsOverride === "object" && body.fallback.settingsOverride !== null
              ? {
                  twilioSmsFallbackEnabled: parseOptionalBoolean(body.fallback.settingsOverride.twilioSmsFallbackEnabled),
                  orangeFallbackEnabled: parseOptionalBoolean(body.fallback.settingsOverride.orangeFallbackEnabled),
                  mtnFallbackEnabled: parseOptionalBoolean(body.fallback.settingsOverride.mtnFallbackEnabled),
                  africasTalkingFallbackEnabled: parseOptionalBoolean(body.fallback.settingsOverride.africasTalkingFallbackEnabled),
                  tpeCloudFallbackEnabled: parseOptionalBoolean(body.fallback.settingsOverride.tpeCloudFallbackEnabled),
                  whatsappFallbackDelayMinutes: parseOverrideDelayMinutes(body.fallback.settingsOverride.whatsappFallbackDelayMinutes),
                }
              : undefined,
          }
        : undefined,
    })

    return NextResponse.json({
      success: true,
      order: result.order,
      fallbackResult: result.fallbackResult,
      fallbackMatch: result.fallbackMatch,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to run manual billing ops test"
    }, { status: 400 })
  }
}