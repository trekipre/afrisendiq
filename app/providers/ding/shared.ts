import { getDingAccessToken } from "@/app/lib/dingAuth"

export type DingErrorCode = {
  Code: string
  Context?: string
}

export type DingEnvelope<T> = {
  ResultCode: number
  ErrorCodes: DingErrorCode[]
  Items?: T[]
  TransferRecord?: T
  ThereAreMoreItems?: boolean
}

type DingQueryValue = string | number | boolean | Array<string> | Array<number> | undefined

type DingRequestOptions = {
  method?: "GET" | "POST"
  query?: Record<string, DingQueryValue>
  body?: unknown
  correlationId?: string
}

function getDingBaseUrl() {
  return (process.env.DING_BASE_URL || "https://www.dingconnect.com/api/V1").replace(/\/$/, "")
}

function buildDingUrl(path: string, query?: Record<string, DingQueryValue>) {
  const cleanPath = path.replace(/^\//, "")
  const url = new URL(`${getDingBaseUrl()}/${cleanPath}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item))
        }
      } else if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url.toString()
}

function formatDingError(response: Response, rawBody: string) {
  const trimmed = rawBody.trim()

  if (trimmed.includes("Cloudflare") || trimmed.includes("Attention Required!")) {
    return `Ding API request failed (${response.status}): Cloudflare blocked the request`
  }

  if (!trimmed) {
    return `Ding API request failed (${response.status})`
  }

  return `Ding API request failed (${response.status}): ${trimmed.slice(0, 240)}`
}

export async function dingRequest<T>(path: string, options: DingRequestOptions = {}) {
  const token = await getDingAccessToken()
  const response = await fetch(buildDingUrl(path, options.query), {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.correlationId ? { "X-Correlation-Id": options.correlationId } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const rawBody = await response.text()

  if (!response.ok) {
    throw new Error(formatDingError(response, rawBody))
  }

  return rawBody ? JSON.parse(rawBody) as DingEnvelope<T> : ({ ResultCode: 0, ErrorCodes: [] } as DingEnvelope<T>)
}