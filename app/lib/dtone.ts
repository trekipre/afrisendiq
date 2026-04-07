type DtOneRequestBody = Record<string, unknown> | undefined
type DtOneQueryValue = string | number | boolean | null | undefined
type DtOneQueryParams = Record<string, DtOneQueryValue>

const DTONE_BASE_URL_REWRITES: Record<string, string> = {
  "digitalreload.dtone.com": "dvs-api.dtone.com"
}

function resolveDtOneBaseUrl() {
  const configuredBaseUrl = process.env.DTONE_BASE_URL?.trim().replace(/\/$/, "")

  if (!configuredBaseUrl) {
    throw new Error("DT One credentials are not configured")
  }

  const url = new URL(configuredBaseUrl)
  const rewrittenHost = DTONE_BASE_URL_REWRITES[url.hostname]

  if (rewrittenHost) {
    url.hostname = rewrittenHost
  }

  return url.toString().replace(/\/$/, "")
}

function buildDtOneUrl(endpoint: string, query?: DtOneQueryParams) {
  const baseUrl = resolveDtOneBaseUrl()

  const url = new URL(`${baseUrl}${endpoint}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url.toString()
}

export async function dtoneRequest(endpoint: string, method = "GET", body?: DtOneRequestBody, query?: DtOneQueryParams) {
  if (!process.env.DTONE_BASE_URL || !process.env.DTONE_API_KEY || !process.env.DTONE_API_SECRET) {
    throw new Error("DT One credentials are not configured")
  }

  const url = buildDtOneUrl(endpoint, query)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization:
      "Basic " +
      Buffer.from(
        `${process.env.DTONE_API_KEY}:${process.env.DTONE_API_SECRET}`
      ).toString("base64")
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  const rawBody = await response.text()
  const contentType = response.headers.get("content-type") || ""
  const isJsonResponse = contentType.toLowerCase().includes("application/json")

  let parsedBody: unknown = undefined

  if (rawBody) {
    if (isJsonResponse) {
      parsedBody = JSON.parse(rawBody)
    } else {
      parsedBody = rawBody
    }
  }

  if (!response.ok) {
    const bodyMessage =
      typeof parsedBody === "string"
        ? parsedBody.trim()
        : parsedBody && typeof parsedBody === "object" && "message" in parsedBody
          ? String((parsedBody as { message?: unknown }).message ?? "")
          : parsedBody && typeof parsedBody === "object"
            ? JSON.stringify(parsedBody)
            : ""

    const errorSuffix = bodyMessage || response.statusText || "Request failed"
    throw new Error(`DT One request failed (${response.status}): ${errorSuffix}`)
  }

  return parsedBody
}

export async function getDTOneProducts() {
  return dtoneRequest("/v1/products", "GET", undefined, {
    country_iso_code: "CIV",
    per_page: 100
  })
}

export type DTOneTransactionInput = {
  productId: number
  creditPartyIdentifier: Record<string, string>
  beneficiaryMobileNumber?: string
  calculationMode?: string
  sourceAmount?: number
  sourceUnit?: string
  sourceUnitType?: string
  destinationAmount?: number
  destinationUnit?: string
  destinationUnitType?: string
  externalId: string
}

export type DTOneTransaction = {
  id: number
  external_id: string
  status: {
    id: number
    message: string
  }
  product: {
    id: number
    name: string
  }
  sender?: Record<string, unknown>
  beneficiary?: Record<string, unknown>
  credit_party_identifier?: Record<string, unknown>
  [key: string]: unknown
}

function collectCandidateRechargeCodes(value: unknown, prioritized: string[] = [], fallback: string[] = [], keyPath = "") {
  if (typeof value === "string") {
    const normalized = value.replace(/\D/g, "")
    if (normalized.length === 20) {
      if (/(token|code|voucher|pin|recharge|credit|unit)/i.test(keyPath)) {
        prioritized.push(normalized)
      } else {
        fallback.push(normalized)
      }
    }
    return { prioritized, fallback }
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectCandidateRechargeCodes(entry, prioritized, fallback, `${keyPath}[${index}]`)
    })
    return { prioritized, fallback }
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      const nextPath = keyPath ? `${keyPath}.${key}` : key
      collectCandidateRechargeCodes(entry, prioritized, fallback, nextPath)
    })
  }

  return { prioritized, fallback }
}

export function extractDTOneRechargeCode(transaction: unknown) {
  const { prioritized, fallback } = collectCandidateRechargeCodes(transaction)
  return prioritized[0] || fallback[0]
}

export async function sendDTOneTransaction(input: DTOneTransactionInput): Promise<DTOneTransaction> {
  const body = {
    product_id: input.productId,
    credit_party_identifier: input.creditPartyIdentifier,
    ...(input.beneficiaryMobileNumber
      ? {
          beneficiary: {
            mobile_number: input.beneficiaryMobileNumber
          }
        }
      : {}),
    ...(input.calculationMode
      ? {
          calculation_mode: input.calculationMode
        }
      : {}),
    ...(input.sourceAmount !== undefined
      ? {
          source: {
            amount: input.sourceAmount,
            ...(input.sourceUnit ? { unit: input.sourceUnit } : {}),
            ...(input.sourceUnitType ? { unit_type: input.sourceUnitType } : {})
          }
        }
      : {}),
    ...(input.destinationAmount !== undefined
      ? {
          destination: {
            amount: input.destinationAmount,
            ...(input.destinationUnit ? { unit: input.destinationUnit } : {}),
            ...(input.destinationUnitType ? { unit_type: input.destinationUnitType } : {})
          }
        }
      : {}),
    external_id: input.externalId
  }

  const result = await dtoneRequest("/v1/async/transactions", "POST", body)
  return result as DTOneTransaction
}

export type DTOneProduct = {
  id: number
  name: string
  type: string
  operator?: { id: number; name: string; country?: { iso_code: string } }
  source?: { amount: number; unit: string; unit_type: string }
  destination?: { amount: number; unit: string; unit_type: string }
  [key: string]: unknown
}

export async function lookupDTOneProduct(productId: number): Promise<DTOneProduct> {
  const result = await dtoneRequest(`/v1/products/${productId}`)
  return result as DTOneProduct
}

function toObjectArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>

    for (const collection of [record.items, record.transactions, record.data]) {
      if (Array.isArray(collection)) {
        return collection.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      }
    }
  }

  return []
}

function findTransactionByExternalId(payload: unknown, externalId: string) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>
    if (String(record.external_id ?? "") === externalId) {
      return record
    }
  }

  return toObjectArray(payload).find((entry) => String(entry.external_id ?? "") === externalId)
}

export async function lookupDTOneTransactionByExternalId(externalId: string) {
  const attempts: Array<() => Promise<unknown>> = [
    () => dtoneRequest(`/v1/async/transactions/${encodeURIComponent(externalId)}`),
    () => dtoneRequest("/v1/async/transactions", "GET", undefined, { external_id: externalId, per_page: 50 }),
    () => dtoneRequest("/v1/transactions", "GET", undefined, { external_id: externalId, per_page: 50 }),
    () => dtoneRequest("/v1/async/transactions", "GET", undefined, { per_page: 50 })
  ]

  const errors: string[] = []

  for (const attempt of attempts) {
    try {
      const payload = await attempt()
      const match = findTransactionByExternalId(payload, externalId)
      if (match) {
        return {
          transaction: match,
          rechargeCode: extractDTOneRechargeCode(match)
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "DT One lookup attempt failed")
    }
  }

  throw new Error(errors[errors.length - 1] || `DT One transaction ${externalId} was not found`)
}