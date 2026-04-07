import { normalizeManualBillingPhone } from "@/app/lib/manualBillingIntelligence"

type TpeCloudSendSmsInput = {
  to: string
  message: string
  from?: string
  senderId?: string
}

export type TpeCloudSendSmsResult = {
  to: string
  from: string
  senderId?: string
  messageId?: string
  status?: string
  summaryMessage?: string
}

type TpeCloudApiFlavor = "legacy-v2" | "panel-http"

type TpeCloudSmsConfig = {
  apiKey?: string
  apiToken?: string
  baseUrl: string
  from?: string
  senderId?: string
  rotate: boolean
  routeId?: string
  flavor: TpeCloudApiFlavor
}

function normalizeTpeCloudRecipient(rawValue?: string) {
  const normalized = normalizeManualBillingPhone(rawValue)
  if (!normalized) {
    return undefined
  }

  const digits = normalized.replace(/\D/g, "")
  return digits || undefined
}

function isLikelyPlaceholder(value?: string | null) {
  if (!value) {
    return false
  }

  const normalized = value.toLowerCase()
  return normalized.includes("replace") || normalized.includes("example") || normalized.includes("your_")
}

function parseTpeCloudRotate(value?: string | null) {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

function isValidTpeCloudSenderId(value?: string) {
  if (!value) {
    return false
  }

  return /^(?=.*[A-Za-z])[A-Za-z0-9]{1,11}$/.test(value)
}

function detectTpeCloudApiFlavor(baseUrl: string, apiToken?: string): TpeCloudApiFlavor {
  if (apiToken || /panel\.smsing\.app\/smsAPI/i.test(baseUrl)) {
    return "panel-http"
  }

  return "legacy-v2"
}

export function getTpeCloudSmsConfig(): TpeCloudSmsConfig {
  const apiToken = process.env.TPE_CLOUD_SMS_API_TOKEN
  const baseUrl = process.env.TPE_CLOUD_SMS_BASE_URL || (apiToken
    ? "https://panel.smsing.app/smsAPI"
    : "https://smsing.cloud/api/v2/SendSMS")

  return {
    apiKey: process.env.TPE_CLOUD_SMS_API_KEY,
    apiToken,
    baseUrl,
    from: process.env.TPE_CLOUD_SMS_FROM,
    senderId: process.env.TPE_CLOUD_SMS_SENDER_ID,
    rotate: parseTpeCloudRotate(process.env.TPE_CLOUD_SMS_ROTATE),
    routeId: process.env.TPE_CLOUD_SMS_ROUTE_ID,
    flavor: detectTpeCloudApiFlavor(baseUrl, apiToken),
  }
}

export function isTpeCloudSmsConfigured() {
  const { apiKey, apiToken, from, senderId, flavor } = getTpeCloudSmsConfig()

  if (flavor === "panel-http") {
    return Boolean(
      apiKey &&
      apiToken &&
      senderId &&
      !isLikelyPlaceholder(apiKey) &&
      !isLikelyPlaceholder(apiToken) &&
      isValidTpeCloudSenderId(senderId)
    )
  }

  return Boolean(
    apiKey &&
    from &&
    !isLikelyPlaceholder(apiKey) &&
    !isLikelyPlaceholder(from) &&
    (!senderId || isValidTpeCloudSenderId(senderId))
  )
}

export async function sendTpeCloudSmsMessage(input: TpeCloudSendSmsInput): Promise<TpeCloudSendSmsResult> {
  const { apiKey, apiToken, baseUrl, from: configuredFrom, senderId: configuredSenderId, rotate, routeId, flavor } = getTpeCloudSmsConfig()
  const to = normalizeTpeCloudRecipient(input.to)
  const message = input.message.trim()
  const from = typeof input.from === "string" && input.from.trim() ? input.from.trim() : configuredFrom
  const senderId = typeof input.senderId === "string" && input.senderId.trim() ? input.senderId.trim() : configuredSenderId

  if (!apiKey || isLikelyPlaceholder(apiKey)) {
    throw new Error("TPE_CLOUD_SMS_API_KEY is required")
  }

  if (senderId && !isValidTpeCloudSenderId(senderId)) {
    throw new Error("TPE_CLOUD_SMS_SENDER_ID must be 1-11 alphanumeric characters and include at least one letter")
  }

  if (!to) {
    throw new Error("A valid TPECloud SMS destination number is required")
  }

  if (!message) {
    throw new Error("TPECloud SMS message body is required")
  }

  if (flavor === "panel-http") {
    if (!apiToken || isLikelyPlaceholder(apiToken)) {
      throw new Error("TPE_CLOUD_SMS_API_TOKEN is required for the SMSing panel API")
    }

    if (!senderId) {
      throw new Error("TPE_CLOUD_SMS_SENDER_ID is required for the SMSing panel API")
    }

    const panelBody = new URLSearchParams({
      apikey: apiKey,
      apitoken: apiToken,
      type: "sms",
      from: senderId,
      to,
      text: message,
      route: routeId?.trim() || "0",
    })

    const panelUrl = /\?/.test(baseUrl) ? `${baseUrl}&sendsms` : `${baseUrl}?sendsms`
    const response = await fetch(panelUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: panelBody.toString(),
    })

    const rawBody = typeof response.text === "function"
      ? await response.text()
      : JSON.stringify(await response.json().catch(() => ({})))

    const payload = (() => {
      try {
        return JSON.parse(rawBody) as {
          request?: string
          status?: string
          message?: string
          group_id?: string | number
          date?: string
        }
      } catch {
        return {}
      }
    })()

    const status = payload.status?.trim()
    const summaryMessage = payload.message || rawBody.trim() || undefined

    if (!response.ok) {
      throw new Error(summaryMessage || `TPECloud SMS send failed with ${response.status}`)
    }

    if (status?.toLowerCase() === "error") {
      throw new Error(summaryMessage || "TPECloud SMS send failed")
    }

    return {
      to,
      from: senderId,
      senderId,
      messageId: payload.group_id != null ? String(payload.group_id) : undefined,
      status,
      summaryMessage,
    }
  }

  if (!from || isLikelyPlaceholder(from)) {
    throw new Error("TPE_CLOUD_SMS_FROM is required")
  }

  const body = new URLSearchParams({
    apikey: apiKey,
    from,
    to,
    message,
  })

  if (senderId) {
    body.set("alphasender", senderId)
  }

  if (rotate) {
    body.set("rotate", "1")
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  const rawBody = typeof response.text === "function"
    ? await response.text()
    : JSON.stringify(await response.json().catch(() => ({})))

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as {
        status?: string | number
        msg?: string
        message?: string
        smsid?: string | number
      }
    } catch {
      return {}
    }
  })()

  const status = payload.status == null ? undefined : String(payload.status).trim()
  const summaryMessage = payload.msg || payload.message || rawBody.trim() || undefined

  if (!response.ok) {
    throw new Error(summaryMessage || `TPECloud SMS send failed with ${response.status}`)
  }

  if (status && status.startsWith("-")) {
    throw new Error(summaryMessage || `TPECloud SMS send failed with status ${status}`)
  }

  const messageId = payload.smsid != null
    ? String(payload.smsid)
    : status && status !== "0"
      ? status
      : undefined

  return {
    to,
    from,
    senderId,
    messageId,
    status,
    summaryMessage,
  }
}