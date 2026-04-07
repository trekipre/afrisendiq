import { toAsciiSmsText } from "@/app/lib/smsText"

type OtpSmsTemplateInput = {
  code: string
  brandName?: string
  expiryMinutes?: number
  purpose?: string
  supportUrl?: string
}

const DEFAULT_BRAND_NAME = "AfriSendIQ"
const DEFAULT_SUPPORT_URL = "afrisendiq.com"
const DEFAULT_EXPIRY_MINUTES = 10

function normalizeOtpCode(value: string) {
  return String(value || "").trim().replace(/\s+/g, "")
}

function normalizeExpiryMinutes(value?: number) {
  if (value === undefined) {
    return DEFAULT_EXPIRY_MINUTES
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("OTP expiryMinutes must be a positive number")
  }

  return Math.floor(value)
}

function normalizePurpose(value?: string) {
  const normalized = String(value || "").trim()
  return normalized.length > 0 ? normalized : "sign-in"
}

export function buildOtpSmsMessage(input: OtpSmsTemplateInput) {
  const code = normalizeOtpCode(input.code)
  if (!/^[A-Za-z0-9]{4,10}$/.test(code)) {
    throw new Error("OTP code must be 4 to 10 alphanumeric characters")
  }

  const brandName = String(input.brandName || DEFAULT_BRAND_NAME).trim() || DEFAULT_BRAND_NAME
  const expiryMinutes = normalizeExpiryMinutes(input.expiryMinutes)
  const purpose = normalizePurpose(input.purpose)
  const supportUrl = String(input.supportUrl || DEFAULT_SUPPORT_URL).trim() || DEFAULT_SUPPORT_URL

  return toAsciiSmsText([
    `${brandName} verification code: ${code}`,
    `Use it to finish your ${purpose}.`,
    `Expires in ${expiryMinutes} min. Do not share this code.`,
    supportUrl,
  ].join("\n"))
}