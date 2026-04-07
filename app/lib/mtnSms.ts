import { normalizeManualBillingPhone } from "@/app/lib/manualBillingIntelligence"

type MtnSmsTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: string | number
}

type MtnSendSmsInput = {
  to: string
  message: string
  clientCorrelator?: string
}

export type MtnSendSmsResult = {
  requestId?: string
  transactionId?: string
  resourceUrl?: string
  senderAddress: string
  to: string
  clientCorrelator?: string
  status?: string
}

export type MtnDeliverySubscriptionResult = {
  subscriptionId?: string
  resourceUrl?: string
  senderAddress: string
  notifyUrl: string
  targetSystem: string
}

type MtnSmsConfig = {
  consumerKey?: string
  consumerSecret?: string
  tokenUrl: string
  baseUrl: string
  senderAddress?: string
  notifyUrl?: string
  targetSystem: string
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null

function normalizeMtnRecipient(rawValue?: string) {
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

export function getMtnSmsConfig(): MtnSmsConfig {
  return {
    consumerKey: process.env.MTN_SMS_CONSUMER_KEY,
    consumerSecret: process.env.MTN_SMS_CONSUMER_SECRET,
    tokenUrl: process.env.MTN_SMS_TOKEN_URL || "https://api.mtn.com/v1/oauth/access_token/accesstoken?grant_type=client_credentials",
    baseUrl: process.env.MTN_SMS_BASE_URL || "https://api.mtn.com/v2",
    senderAddress: process.env.MTN_SMS_SENDER_ADDRESS,
    notifyUrl: process.env.MTN_SMS_NOTIFY_URL,
    targetSystem: process.env.MTN_SMS_TARGET_SYSTEM || "MADAPI",
  }
}

export function isMtnSmsConfigured() {
  const { consumerKey, consumerSecret, senderAddress } = getMtnSmsConfig()

  return Boolean(
    consumerKey &&
    consumerSecret &&
    senderAddress &&
    !isLikelyPlaceholder(consumerKey) &&
    !isLikelyPlaceholder(consumerSecret) &&
    !isLikelyPlaceholder(senderAddress)
  )
}

function buildBasicAuthHeader(consumerKey: string, consumerSecret: string) {
  return `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`
}

async function getMtnAccessToken() {
  const { consumerKey, consumerSecret, tokenUrl } = getMtnSmsConfig()

  if (!consumerKey || !consumerSecret || isLikelyPlaceholder(consumerKey) || isLikelyPlaceholder(consumerSecret)) {
    throw new Error("MTN SMS V2 credentials are not fully configured")
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(consumerKey, consumerSecret),
      Accept: "application/json",
    },
  })

  const payload = await response.json().catch(() => ({})) as MtnSmsTokenResponse & { error_description?: string; message?: string }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.message || `MTN token request failed with ${response.status}`)
  }

  const expiresInSeconds = Number(payload.expires_in || 3600)
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: now + Math.max(expiresInSeconds - 60, 60) * 1000,
  }

  return payload.access_token
}

function createClientCorrelator() {
  return crypto.randomUUID().slice(0, 36)
}

export async function sendMtnSmsMessage(input: MtnSendSmsInput): Promise<MtnSendSmsResult> {
  const { baseUrl, senderAddress } = getMtnSmsConfig()
  const to = normalizeMtnRecipient(input.to)
  const message = input.message.trim()
  const clientCorrelator = (input.clientCorrelator || createClientCorrelator()).slice(0, 36)

  if (!senderAddress || isLikelyPlaceholder(senderAddress)) {
    throw new Error("MTN_SMS_SENDER_ADDRESS is required")
  }

  if (!to) {
    throw new Error("A valid MTN SMS destination number is required")
  }

  if (!message) {
    throw new Error("MTN SMS message body is required")
  }

  if (message.length > 160) {
    throw new Error("MTN SMS message body must be 160 characters or fewer")
  }

  const accessToken = await getMtnAccessToken()
  const response = await fetch(`${baseUrl}/messages/sms/outbound`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      senderAddress,
      receiverAddress: [to],
      message,
      clientCorrelator,
    }),
  })

  const payload = await response.json().catch(() => ({})) as {
    statusCode?: string
    statusMessage?: string
    transactionId?: string
    data?: {
      requestId?: string
      clientCorrelator?: string
      status?: string
    }
    _link?: {
      self?: {
        href?: string
      }
    }
  }

  if (!response.ok || payload.statusCode !== "0000") {
    throw new Error(payload.statusMessage || `MTN SMS send failed with ${response.status}`)
  }

  return {
    requestId: payload.data?.requestId,
    transactionId: payload.transactionId,
    resourceUrl: payload._link?.self?.href,
    senderAddress,
    to,
    clientCorrelator: payload.data?.clientCorrelator || clientCorrelator,
    status: payload.data?.status,
  }
}

export async function subscribeMtnSmsDeliveryNotifications(): Promise<MtnDeliverySubscriptionResult> {
  const { baseUrl, notifyUrl, senderAddress, targetSystem } = getMtnSmsConfig()

  if (!senderAddress || isLikelyPlaceholder(senderAddress)) {
    throw new Error("MTN_SMS_SENDER_ADDRESS is required")
  }

  if (!notifyUrl || isLikelyPlaceholder(notifyUrl)) {
    throw new Error("MTN_SMS_NOTIFY_URL is required to subscribe to delivery notifications")
  }

  const accessToken = await getMtnAccessToken()
  const response = await fetch(`${baseUrl}/messages/sms/outbound/${encodeURIComponent(senderAddress)}/subscription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      notifyUrl,
      targetSystem,
    }),
  })

  const payload = await response.json().catch(() => ({})) as {
    statusCode?: string
    statusMessage?: string
    data?: {
      subscriptionId?: string
    }
    _link?: {
      self?: {
        href?: string
      }
    }
  }

  if (!response.ok || payload.statusCode !== "0000") {
    throw new Error(payload.statusMessage || `MTN delivery receipt subscription failed with ${response.status}`)
  }

  return {
    subscriptionId: payload.data?.subscriptionId,
    resourceUrl: payload._link?.self?.href,
    senderAddress,
    notifyUrl,
    targetSystem,
  }
}