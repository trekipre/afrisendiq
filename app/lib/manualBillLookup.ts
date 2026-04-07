import type {
  ManualBillingLookupResult,
  ManualBillingLookupSource,
  ManualBillingOrder,
  ManualBillingService,
} from "@/app/lib/manualBillingState"
import { normalizeManualBillingAccountReference } from "@/app/lib/manualBillingIntelligence"

type ManualBillLookupInput = {
  service: Extract<ManualBillingService, "sodeci" | "cie-postpaid">
  accountReference: string
  existingOrders: ManualBillingOrder[]
}

type LookupAdapter = {
  source: ManualBillingLookupSource
  lookup(input: ManualBillLookupInput): Promise<ManualBillingLookupResult | null>
}

function buildResult(source: ManualBillingLookupSource, partial: Omit<ManualBillingLookupResult, "source" | "lookedUpAt">): ManualBillingLookupResult {
  return {
    ...partial,
    source,
    lookedUpAt: new Date().toISOString(),
  }
}

function parseFixtureMap() {
  try {
    const raw = String(process.env.MANUAL_BILLING_LOOKUP_FIXTURES || "").trim()
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Record<string, { amount?: number; detail?: string }>
    return parsed
  } catch (error) {
    console.error("[manual-bill-lookup] Invalid MANUAL_BILLING_LOOKUP_FIXTURES JSON:", error)
    return null
  }
}

const externalHttpAdapter: LookupAdapter = {
  source: "external_http",
  async lookup(input) {
    const endpoint = String(process.env.MANUAL_BILLING_LOOKUP_ENDPOINT || "").trim()
    if (!endpoint) {
      return null
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MANUAL_BILLING_LOOKUP_API_KEY
            ? { Authorization: `Bearer ${process.env.MANUAL_BILLING_LOOKUP_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          service: input.service,
          accountReference: input.accountReference,
          countryCode: "CI",
        }),
      })

      if (!response.ok) {
        return buildResult("external_http", {
          status: "unavailable",
          confidence: "low",
          detail: `Lookup endpoint returned ${response.status}`,
        })
      }

      const payload = await response.json() as {
        found?: boolean
        amount?: number
        currency?: string
        detail?: string
        confidence?: "low" | "medium" | "high"
        providerReference?: string
      }

      if (!payload.found || !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) {
        return buildResult("external_http", {
          status: payload.found === false ? "not_found" : "unavailable",
          confidence: payload.confidence || "low",
          detail: payload.detail || "Lookup provider did not return a bill amount.",
        })
      }

      return buildResult("external_http", {
        status: "found",
        confidence: payload.confidence || "high",
        amount: Math.round(Number(payload.amount)),
        currency: "XOF",
        detail: payload.detail || "Live bill amount returned by configured provider.",
        providerReference: payload.providerReference,
      })
    } catch (error) {
      return buildResult("external_http", {
        status: "unavailable",
        confidence: "low",
        detail: error instanceof Error ? error.message : "Lookup request failed",
      })
    }
  },
}

const fixtureAdapter: LookupAdapter = {
  source: "fixture",
  async lookup(input) {
    const fixtures = parseFixtureMap()
    if (!fixtures) {
      return null
    }

    const match = fixtures[`${input.service}:${input.accountReference}`] || fixtures[input.accountReference]
    if (!match || !Number.isFinite(Number(match.amount)) || Number(match.amount) <= 0) {
      return buildResult("fixture", {
        status: "not_found",
        confidence: "medium",
        detail: "No fixture amount matched this reference.",
      })
    }

    return buildResult("fixture", {
      status: "found",
      confidence: "medium",
      amount: Math.round(Number(match.amount)),
      currency: "XOF",
      detail: match.detail || "Fixture lookup matched this reference.",
    })
  },
}

const historicalAdapter: LookupAdapter = {
  source: "historical",
  async lookup(input) {
    const latestMatch = [...input.existingOrders]
      .filter((order) => order.service === input.service)
      .filter((order) => normalizeManualBillingAccountReference(order.service, order.accountReference) === input.accountReference)
      .filter((order) => order.status === "completed")
      .filter((order) => typeof order.pricingSummary?.inputAmount === "number")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]

    if (!latestMatch || typeof latestMatch.pricingSummary?.inputAmount !== "number") {
      return null
    }

    const ageDays = Math.floor((Date.now() - new Date(latestMatch.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    if (!Number.isFinite(ageDays) || ageDays > 30) {
      return buildResult("historical", {
        status: "not_found",
        confidence: "low",
        detail: "Historical bill amount is too old to auto-quote safely.",
      })
    }

    return buildResult("historical", {
      status: "found",
      confidence: ageDays <= 7 ? "medium" : "low",
      amount: Math.round(latestMatch.pricingSummary.inputAmount),
      currency: "XOF",
      detail: `Using the most recent completed bill amount from ${ageDays} day${ageDays === 1 ? "" : "s"} ago.`,
      providerReference: latestMatch.id,
    })
  },
}

const adapters: LookupAdapter[] = [externalHttpAdapter, fixtureAdapter, historicalAdapter]

export async function lookupManualBillAmount(input: ManualBillLookupInput): Promise<ManualBillingLookupResult> {
  for (const adapter of adapters) {
    const result = await adapter.lookup(input)
    if (result) {
      return result
    }
  }

  return {
    status: "unavailable",
    source: "historical",
    confidence: "low",
    detail: "No manual bill lookup adapter is configured.",
    lookedUpAt: new Date().toISOString(),
  }
}