import { normalizeManualBillingPhone } from "@/app/lib/manualBillingIntelligence"

type AfricasTalkingSendSmsInput = {
  to: string
  message: string
}

export type AfricasTalkingSendSmsResult = {
  to: string
  senderId: string
  messageId?: string
  cost?: string
  status?: string
  statusCode?: number
  summaryMessage?: string
}

type AfricasTalkingSmsConfig = {
  username?: string
  apiKey?: string
  baseUrl: string
  senderId?: string
  enqueue: boolean
}

function normalizeAfricasTalkingRecipient(rawValue?: string) {
  const normalized = normalizeManualBillingPhone(rawValue)
  if (!normalized) {
    return undefined
  }

  const digits = normalized.replace(/\D/g, "")
  return digits ? `+${digits}` : undefined
}

function isLikelyPlaceholder(value?: string | null) {
  if (!value) {
    return false
  }

  const normalized = value.toLowerCase()
  return normalized.includes("replace") || normalized.includes("example") || normalized.includes("your_")
}

function parseAfricasTalkingEnqueue(value?: string | null) {
  if (!value) {
    return true
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false
  }

  return true
}

export function getAfricasTalkingSmsConfig(): AfricasTalkingSmsConfig {
  return {
    username: process.env.AFRICAS_TALKING_USERNAME,
    apiKey: process.env.AFRICAS_TALKING_API_KEY,
    baseUrl: process.env.AFRICAS_TALKING_SMS_BASE_URL || "https://api.africastalking.com/version1/messaging/bulk",
    senderId: process.env.AFRICAS_TALKING_SENDER_ID,
    enqueue: parseAfricasTalkingEnqueue(process.env.AFRICAS_TALKING_SMS_ENQUEUE),
  }
}

export function isAfricasTalkingSmsConfigured() {
  const { username, apiKey, senderId } = getAfricasTalkingSmsConfig()

  return Boolean(
    username &&
    apiKey &&
    senderId &&
    !isLikelyPlaceholder(username) &&
    !isLikelyPlaceholder(apiKey) &&
    !isLikelyPlaceholder(senderId)
  )
}

export async function sendAfricasTalkingSmsMessage(input: AfricasTalkingSendSmsInput): Promise<AfricasTalkingSendSmsResult> {
  const { username, apiKey, baseUrl, senderId, enqueue } = getAfricasTalkingSmsConfig()
  const to = normalizeAfricasTalkingRecipient(input.to)
  const message = input.message.trim()

  if (!username || isLikelyPlaceholder(username)) {
    throw new Error("AFRICAS_TALKING_USERNAME is required")
  }

  if (!apiKey || isLikelyPlaceholder(apiKey)) {
    throw new Error("AFRICAS_TALKING_API_KEY is required")
  }

  if (!senderId || isLikelyPlaceholder(senderId)) {
    throw new Error("AFRICAS_TALKING_SENDER_ID is required")
  }

  if (!to) {
    throw new Error("A valid Africa's Talking SMS destination number is required")
  }

  if (!message) {
    throw new Error("Africa's Talking SMS message body is required")
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      message,
      senderId,
      phoneNumbers: [to],
      enqueue,
    }),
  })

  const rawBody = typeof response.text === "function"
    ? await response.text()
    : JSON.stringify(await response.json().catch(() => ({})))
  const payload = (() => {
    try {
      return JSON.parse(rawBody) as {
        SMSMessageData?: {
          Message?: string
          Recipients?: Array<{
            statusCode?: number
            number?: string
            status?: string
            cost?: string
            messageId?: string
          }>
        }
        errorMessage?: string
      }
    } catch {
      return {}
    }
  })()

  const responseMessage = payload.errorMessage || payload.SMSMessageData?.Message || rawBody.trim()

  const recipient = payload.SMSMessageData?.Recipients?.[0]
  if (!response.ok || !recipient || !recipient.number) {
    throw new Error(responseMessage || `Africa's Talking SMS send failed with ${response.status}`)
  }

  return {
    to: recipient.number,
    senderId,
    messageId: recipient.messageId,
    cost: recipient.cost,
    status: recipient.status,
    statusCode: recipient.statusCode,
    summaryMessage: payload.SMSMessageData?.Message,
  }
}