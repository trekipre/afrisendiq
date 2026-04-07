import { normalizeManualBillingPhone } from "@/app/lib/manualBillingIntelligence"

type OrangeSmsTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: string | number
}

type OrangeSendSmsInput = {
  to: string
  message: string
}

export type OrangeSendSmsResult = {
  resourceId?: string
  resourceUrl?: string
  senderAddress: string
  senderName?: string
  to: string
}

type OrangeSmsConfig = {
  clientId?: string
  clientSecret?: string
  tokenUrl: string
  messagingBaseUrl: string
  adminBaseUrl: string
  senderAddress: string
  senderName?: string
  countryCode: string
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null

function normalizeOrangeRecipient(rawValue?: string) {
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

export function getOrangeSmsConfig(): OrangeSmsConfig {
  return {
    clientId: process.env.ORANGE_SMS_CLIENT_ID,
    clientSecret: process.env.ORANGE_SMS_CLIENT_SECRET,
    tokenUrl: process.env.ORANGE_SMS_TOKEN_URL || "https://api.orange.com/oauth/v3/token",
    messagingBaseUrl: process.env.ORANGE_SMS_BASE_URL || "https://api.orange.com/smsmessaging/v1",
    adminBaseUrl: process.env.ORANGE_SMS_ADMIN_BASE_URL || "https://api.orange.com/sms/admin/v1",
    senderAddress: process.env.ORANGE_SMS_SENDER_ADDRESS || "tel:+2250000",
    senderName: process.env.ORANGE_SMS_SENDER_NAME || undefined,
    countryCode: process.env.ORANGE_SMS_COUNTRY_CODE || "CIV",
  }
}

export function isOrangeSmsConfigured() {
  const { clientId, clientSecret, senderAddress } = getOrangeSmsConfig()

  return Boolean(
    clientId &&
    clientSecret &&
    !isLikelyPlaceholder(clientId) &&
    !isLikelyPlaceholder(clientSecret) &&
    /^tel:\+\d{4,15}$/.test(senderAddress)
  )
}

function buildOrangeBasicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
}

function getEncodedSenderAddress(senderAddress: string) {
  return encodeURIComponent(senderAddress)
}

async function getOrangeAccessToken() {
  const { clientId, clientSecret, tokenUrl } = getOrangeSmsConfig()

  if (!clientId || !clientSecret || isLikelyPlaceholder(clientId) || isLikelyPlaceholder(clientSecret)) {
    throw new Error("Orange SMS credentials are not fully configured")
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: buildOrangeBasicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  })

  const payload = await response.json() as OrangeSmsTokenResponse & { error_description?: string; message?: string }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.message || `Orange token request failed with ${response.status}`)
  }

  const expiresInSeconds = Number(payload.expires_in || 3600)
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: now + Math.max(expiresInSeconds - 60, 60) * 1000,
  }

  return payload.access_token
}

export async function sendOrangeSmsMessage(input: OrangeSendSmsInput): Promise<OrangeSendSmsResult> {
  const { messagingBaseUrl, senderAddress, senderName } = getOrangeSmsConfig()
  const to = normalizeOrangeRecipient(input.to)
  const message = input.message.trim()

  if (!to) {
    throw new Error("A valid Orange SMS destination number is required")
  }

  if (!message) {
    throw new Error("Orange SMS message body is required")
  }

  if (!/^tel:\+\d{4,15}$/.test(senderAddress)) {
    throw new Error("ORANGE_SMS_SENDER_ADDRESS must use the tel:+2250000 format")
  }

  const accessToken = await getOrangeAccessToken()
  const response = await fetch(`${messagingBaseUrl}/outbound/${getEncodedSenderAddress(senderAddress)}/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      outboundSMSMessageRequest: {
        address: `tel:${to}`,
        senderAddress,
        ...(senderName ? { senderName } : {}),
        outboundSMSTextMessage: {
          message,
        },
      },
    }),
  })

  const payload = await response.json() as {
    outboundSMSMessageRequest?: {
      resourceURL?: string
      senderAddress?: string
      senderName?: string
    }
    requestError?: {
      serviceException?: {
        text?: string
      }
      policyException?: {
        text?: string
      }
    }
  }

  if (!response.ok) {
    const errorMessage = payload.requestError?.serviceException?.text || payload.requestError?.policyException?.text || `Orange SMS send failed with ${response.status}`
    throw new Error(errorMessage)
  }

  const resourceUrl = payload.outboundSMSMessageRequest?.resourceURL
  const resourceId = resourceUrl?.split("/").filter(Boolean).at(-1)

  return {
    resourceId,
    resourceUrl,
    senderAddress: payload.outboundSMSMessageRequest?.senderAddress || senderAddress,
    senderName: payload.outboundSMSMessageRequest?.senderName || senderName,
    to,
  }
}

export async function listOrangeSmsContracts() {
  const { adminBaseUrl, countryCode } = getOrangeSmsConfig()
  const accessToken = await getOrangeAccessToken()
  const response = await fetch(`${adminBaseUrl}/contracts?country=${encodeURIComponent(countryCode)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(`Orange SMS contracts request failed with ${response.status}`)
  }

  return Array.isArray(payload) ? payload : payload?.purchaseOrders || []
}