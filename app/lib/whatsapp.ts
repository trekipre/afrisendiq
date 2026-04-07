import { normalizeManualBillingPhone } from "@/app/lib/manualBillingIntelligence"

const TWILIO_WHATSAPP_SANDBOX_FROM = "whatsapp:+14155238886"

type SendTwilioWhatsAppMessageInput = {
  to: string
  statusCallback?: string
  messagingServiceSid?: string
} & (
  | {
      body: string
      contentSid?: never
      contentVariables?: never
    }
  | {
      body?: never
      contentSid: string
      contentVariables?: Record<string, string | number | boolean | null> | string
    }
)

type SendTwilioSmsMessageInput = {
  to: string
  body: string
  statusCallback?: string
  from?: string
}

type SendTwilioWhatsAppMessageResult = {
  sid: string
  to: string
  from: string
  whatsappHref?: string
}

type SendTwilioSmsMessageResult = {
  sid: string
  to: string
  from: string
  status?: string | null
}

function stripWhatsAppPrefix(value?: string) {
  const normalized = String(value || "").trim()
  return normalized.startsWith("whatsapp:") ? normalized.slice("whatsapp:".length) : normalized || undefined
}

function getConfiguredSoutraliSmsSenderId() {
  const normalized = String(process.env.TWILIO_SOUTRALI_SMS_SENDER_ID || "").trim()
  return /^[A-Za-z0-9]{1,11}$/.test(normalized) ? normalized : undefined
}

function resolveDefaultTwilioSmsFrom() {
  return getConfiguredSoutraliSmsSenderId()
    || normalizeTwilioSmsFrom(process.env.TWILIO_SMS_FROM)
    || normalizeTwilioSmsFrom(stripWhatsAppPrefix(process.env.TWILIO_WHATSAPP_FROM))
}

function getTwilioWhatsAppConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_FROM,
  }
}

export function isTwilioSandboxWhatsAppSender(value?: string) {
  return String(value || "").trim() === TWILIO_WHATSAPP_SANDBOX_FROM
}

export function getTwilioSmsConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: resolveDefaultTwilioSmsFrom(),
  }
}

export function normalizeTwilioSmsFrom(rawValue?: string) {
  const normalized = String(rawValue || "").trim()
  if (!normalized) {
    return undefined
  }

  if (normalized.startsWith("+")) {
    return normalized
  }

  return /^[A-Za-z0-9]{1,11}$/.test(normalized) ? normalized : undefined
}

function normalizeWhatsAppRecipient(rawValue?: string) {
  const normalized = normalizeManualBillingPhone(rawValue)
  if (!normalized) {
    return undefined
  }

  return normalized.startsWith("+") ? normalized : `+${normalized.replace(/\D/g, "")}`
}

export function buildWhatsAppHref(target: string, message: string) {
  const digits = target.replace(/\D/g, "")
  if (!digits) {
    return undefined
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function getTwilioWhatsAppStatusCallbackUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) {
    return undefined
  }

  try {
    return new URL("/api/twilio/status", baseUrl).toString()
  } catch {
    return undefined
  }
}

export function getTwilioSmsStatusCallbackUrl() {
  return getTwilioWhatsAppStatusCallbackUrl()
}

function normalizeMessageBody(body: string) {
  return body.trim().normalize("NFC")
}

function normalizeContentVariables(
  value?: Record<string, string | number | boolean | null> | string
) {
  if (!value) {
    return undefined
  }

  return typeof value === "string" ? value : JSON.stringify(value)
}

export async function sendTwilioWhatsAppMessage(
  input: SendTwilioWhatsAppMessageInput
): Promise<SendTwilioWhatsAppMessageResult> {
  const body = "body" in input && typeof input.body === "string"
    ? normalizeMessageBody(input.body)
    : ""
  const to = normalizeWhatsAppRecipient(input.to)
  const { accountSid, authToken, from } = getTwilioWhatsAppConfig()

  if (!input.contentSid && !body) {
    throw new Error("WhatsApp message body is required")
  }

  if (input.contentSid && !String(input.contentSid || "").trim()) {
    throw new Error("WhatsApp content SID is required when sending a template")
  }

  if (!to) {
    throw new Error("A valid WhatsApp destination number is required")
  }

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio WhatsApp credentials are not fully configured")
  }

  if (isTwilioSandboxWhatsAppSender(from)) {
    throw new Error("Twilio WhatsApp sender is still set to the sandbox sender; live delivery is blocked until an approved production sender is configured")
  }

  const { default: twilio } = await import("twilio")
  const client = twilio(accountSid, authToken)
  const contentVariables = "contentSid" in input
    ? normalizeContentVariables(input.contentVariables)
    : undefined
  const twilioMessage = await client.messages.create({
    from,
    to: `whatsapp:${to}`,
    ...(input.statusCallback ? { statusCallback: input.statusCallback } : {}),
    ...(input.messagingServiceSid ? { messagingServiceSid: input.messagingServiceSid } : {}),
    ...("contentSid" in input
      ? {
          contentSid: input.contentSid,
          ...(contentVariables ? { contentVariables } : {}),
        }
      : { body }),
  })

  return {
    sid: twilioMessage.sid,
    from,
    to,
    whatsappHref: buildWhatsAppHref(to, body)
  }
}

export async function sendTwilioSmsMessage(
  input: SendTwilioSmsMessageInput
): Promise<SendTwilioSmsMessageResult> {
  const body = normalizeMessageBody(input.body)
  const to = normalizeWhatsAppRecipient(input.to)
  const { accountSid, authToken, from: defaultFrom } = getTwilioSmsConfig()
  const from = normalizeTwilioSmsFrom(input.from) || defaultFrom

  if (!body) {
    throw new Error("SMS message body is required")
  }

  if (!to) {
    throw new Error("A valid SMS destination number is required")
  }

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio SMS credentials are not fully configured")
  }

  const { default: twilio } = await import("twilio")
  const client = twilio(accountSid, authToken)
  const twilioMessage = await client.messages.create({
    body,
    from,
    to,
    ...(input.statusCallback ? { statusCallback: input.statusCallback } : {})
  })

  return {
    sid: twilioMessage.sid,
    from,
    to,
    status: twilioMessage.status ?? null,
  }
}