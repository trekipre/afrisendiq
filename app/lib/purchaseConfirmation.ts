import { normalizeManualBillingPhone } from "@/app/lib/manualBillingIntelligence"
import { toAsciiSmsText } from "@/app/lib/smsText"
import {
  getTwilioSmsConfig,
  getTwilioSmsStatusCallbackUrl,
  getTwilioWhatsAppStatusCallbackUrl,
  sendTwilioWhatsAppMessage,
  sendTwilioSmsMessage,
} from "@/app/lib/whatsapp"

type PurchaseConfirmationInput = {
  reference: string
  productLabel: string
  productCategory?: "airtime" | "data" | "electricity" | "gift-card"
  productBrand?: string
  amount: number
  currency: string
  recipientPhoneCandidates: Array<string | undefined>
  senderName?: string
  rechargeCode?: string
}

type PurchaseConfirmationDependencies = {
  getSmsStatusCallbackUrl: typeof getTwilioSmsStatusCallbackUrl
  getWhatsAppStatusCallbackUrl: typeof getTwilioWhatsAppStatusCallbackUrl
  getTwilioConfig: typeof getTwilioSmsConfig
  getWhatsAppTemplateConfig: typeof getPurchaseConfirmationWhatsAppTemplateConfig
  sendSms: typeof sendTwilioSmsMessage
  sendWhatsApp: typeof sendTwilioWhatsAppMessage
}

export type PurchaseConfirmationResult =
  | {
      delivered: true
      to: string
      sid?: string
      whatsappSid?: string
      body: string
    }
  | {
      delivered: false
      reason: string
    }

const defaultDependencies: PurchaseConfirmationDependencies = {
  getSmsStatusCallbackUrl: getTwilioSmsStatusCallbackUrl,
  getWhatsAppStatusCallbackUrl: getTwilioWhatsAppStatusCallbackUrl,
  getTwilioConfig: getTwilioSmsConfig,
  getWhatsAppTemplateConfig: getPurchaseConfirmationWhatsAppTemplateConfig,
  sendSms: sendTwilioSmsMessage,
  sendWhatsApp: sendTwilioWhatsAppMessage,
}

const DEFAULT_SOUTRALI_SENDER_NAME = "AfriSendIQ"
const DEFAULT_SOUTRALI_SMS_SENDER_ID = "SOUTRALI"
const PROVIDER_NAME_PATTERN = /\b(?:dt\s*one|dtone|reloadly|ding)\b/gi

function isCiePrepaid(input: Omit<PurchaseConfirmationInput, "recipientPhoneCandidates">) {
  return input.productCategory === "electricity" && String(input.productBrand || "").trim().toUpperCase() === "CIE"
}

function formatAmount(amount: number) {
  if (Number.isInteger(amount)) {
    return String(amount)
  }

  return amount.toFixed(2).replace(/\.00$/, "")
}

function normalizeSmsCandidate(value?: string) {
  const normalized = normalizeManualBillingPhone(value)
  if (!normalized || normalized.includes("@")) {
    return undefined
  }

  const digits = normalized.replace(/\D/g, "")
  if (digits.length < 8) {
    return undefined
  }

  return normalized
}

function resolveRecipient(candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const normalized = normalizeSmsCandidate(candidate)
    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function sanitizeProductLabel(productLabel: string) {
  const withoutProviderNames = productLabel.replace(PROVIDER_NAME_PATTERN, " ")

  return withoutProviderNames
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim()
}

function buildSoutraliProductDescriptor(input: Omit<PurchaseConfirmationInput, "recipientPhoneCandidates">) {
  const productLabel = sanitizeProductLabel(input.productLabel)
  const productBrand = String(input.productBrand || "").trim().toUpperCase()
  const normalizedLabel = productLabel.toLowerCase()

  if (input.productCategory === "gift-card" && (productBrand === "JUMIA" || normalizedLabel.includes("jumia"))) {
    return "bon Jumia"
  }

  if (input.productCategory === "airtime") {
    const airtimeLabel = productLabel.replace(/\bairtime\b/gi, " ").replace(/\s{2,}/g, " ").trim()
    return `credit ${airtimeLabel}`
  }

  if (input.productCategory === "data") {
    return `data ${productLabel}`
  }

  if (input.productCategory === "electricity" && productBrand === "CIE") {
    return "compteur CIE prepaye"
  }

  return productLabel
}

function buildRichSoutraliProductDescriptor(input: Omit<PurchaseConfirmationInput, "recipientPhoneCandidates">) {
  const productLabel = sanitizeProductLabel(input.productLabel)
  const productBrand = String(input.productBrand || "").trim().toUpperCase()
  const normalizedLabel = productLabel.toLowerCase()

  if (input.productCategory === "gift-card" && (productBrand === "JUMIA" || normalizedLabel.includes("jumia"))) {
    return "bon d'achat Jumia"
  }

  if (input.productCategory === "airtime") {
    const airtimeLabel = productLabel.replace(/\bairtime\b/gi, " ").replace(/\s{2,}/g, " ").trim()
    return `recharge d'unites ${airtimeLabel}`
  }

  if (input.productCategory === "data") {
    return `recharge de connexion ${productLabel}`
  }

  if (input.productCategory === "electricity" && input.productBrand === "CIE") {
    return "recharge de compteur prepaye"
  }

  return productLabel
}

function formatRechargeCodeForMessage(input: Omit<PurchaseConfirmationInput, "recipientPhoneCandidates">) {
  const rechargeCode = String(input.rechargeCode || "").trim()
  if (!rechargeCode) {
    return undefined
  }

  if (!isCiePrepaid(input)) {
    return rechargeCode
  }

  const digits = rechargeCode.replace(/\D/g, "")
  if (digits.length === 20) {
    return digits.match(/.{1,4}/g)?.join(" ") || digits
  }

  return rechargeCode
}

export function buildPurchaseConfirmationSmsMessage(input: Omit<PurchaseConfirmationInput, "recipientPhoneCandidates">) {
  const senderName = String(input.senderName || DEFAULT_SOUTRALI_SENDER_NAME).trim() || DEFAULT_SOUTRALI_SENDER_NAME
  const productDescriptor = buildSoutraliProductDescriptor(input)
  const codeLabel = isCiePrepaid(input)
    ? "Code de recharge"
    : "Code"
  const formattedRechargeCode = formatRechargeCodeForMessage(input)
  const codeLine = formattedRechargeCode ? `${codeLabel} ${formattedRechargeCode}` : null
  const jumiaLine = input.productCategory === "gift-card" || input.productBrand === "JUMIA"
    ? "jumia.ci"
    : null

  return toAsciiSmsText([
    `Soutrali: ${productDescriptor}. De ${senderName} via AfriSendIQ.`,
    `Montant ${formatAmount(input.amount)} ${input.currency}`,
    `Ref ${input.reference}`,
    codeLine,
    jumiaLine,
    "afrisendiq.com",
  ].filter(Boolean).join("\n"))
}

export function buildPurchaseConfirmationWhatsAppMessage(input: Omit<PurchaseConfirmationInput, "recipientPhoneCandidates">) {
  const senderName = String(input.senderName || DEFAULT_SOUTRALI_SENDER_NAME).trim() || DEFAULT_SOUTRALI_SENDER_NAME
  const productDescriptor = buildRichSoutraliProductDescriptor(input)
  const codeLabel = isCiePrepaid(input)
    ? "Code de recharge"
    : "Code"
  const formattedRechargeCode = formatRechargeCodeForMessage(input)
  const codeLine = formattedRechargeCode ? `${codeLabel} : ${formattedRechargeCode}` : null
  const jumiaLine = input.productCategory === "gift-card" || input.productBrand === "JUMIA"
    ? "A utiliser sur www.jumia.ci"
    : null

  return [
    `Vous avez recu un Soutrali de ${productDescriptor}, par le service Soutrali d'AfriSendIQ, de la part de ${senderName}.`,
    `Montant : ${formatAmount(input.amount)} ${input.currency}`,
    `Reference : ${input.reference}`,
    codeLine,
    jumiaLine,
    "www.AfriSendIQ.com",
  ].filter(Boolean).join("\n")
}

export function buildPurchaseConfirmationMessage(input: Omit<PurchaseConfirmationInput, "recipientPhoneCandidates">) {
  return buildPurchaseConfirmationSmsMessage(input)
}

function getSoutraliSmsSenderId() {
  const configured = String(process.env.TWILIO_SOUTRALI_SMS_SENDER_ID || "").trim()
  const candidate = configured || DEFAULT_SOUTRALI_SMS_SENDER_ID

  return /^[A-Za-z0-9]{1,11}$/.test(candidate) ? candidate : undefined
}

function getPurchaseConfirmationWhatsAppTemplateConfig() {
  return {
    contentSid: String(process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID || "").trim() || undefined,
    messagingServiceSid: String(process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID || "").trim() || undefined,
  }
}

function buildPurchaseConfirmationWhatsAppTemplateVariables(message: string) {
  return {
    "1": message,
  }
}

function formatWhatsAppFailureReason(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: string | number }).code)
    : undefined
  const message = error instanceof Error ? error.message : "Twilio WhatsApp delivery failed"

  return code ? `Twilio WhatsApp delivery failed (${code}): ${message}` : message
}

export async function sendPurchaseConfirmationSms(
  input: PurchaseConfirmationInput,
  overrides: Partial<PurchaseConfirmationDependencies> = {}
): Promise<PurchaseConfirmationResult> {
  const deps = { ...defaultDependencies, ...overrides }
  const recipient = resolveRecipient(input.recipientPhoneCandidates)
  const whatsappTemplateConfig = deps.getWhatsAppTemplateConfig()

  if (!recipient) {
    return {
      delivered: false,
      reason: "No valid recipient phone was available for confirmation SMS",
    }
  }

  const body = buildPurchaseConfirmationSmsMessage({
    reference: input.reference,
    productLabel: input.productLabel,
    productCategory: input.productCategory,
    productBrand: input.productBrand,
    amount: input.amount,
    currency: input.currency,
    senderName: input.senderName,
    rechargeCode: input.rechargeCode,
  })
  const whatsappBody = buildPurchaseConfirmationWhatsAppMessage({
    reference: input.reference,
    productLabel: input.productLabel,
    productCategory: input.productCategory,
    productBrand: input.productBrand,
    amount: input.amount,
    currency: input.currency,
    senderName: input.senderName,
    rechargeCode: input.rechargeCode,
  })

  if (whatsappTemplateConfig.contentSid) {
    try {
      const whatsappResult = await deps.sendWhatsApp({
        to: recipient,
        contentSid: whatsappTemplateConfig.contentSid,
        contentVariables: buildPurchaseConfirmationWhatsAppTemplateVariables(whatsappBody),
        messagingServiceSid: whatsappTemplateConfig.messagingServiceSid,
        statusCallback: deps.getWhatsAppStatusCallbackUrl(),
      })

      return {
        delivered: true,
        to: whatsappResult.to,
        whatsappSid: whatsappResult.sid,
        body,
      }
    } catch (error) {
      const twilioConfig = deps.getTwilioConfig()
      if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.from) {
        return {
          delivered: false,
          reason: `${formatWhatsAppFailureReason(error)}. Twilio SMS is not fully configured for fallback`,
        }
      }

      const result = await deps.sendSms({
        to: recipient,
        body,
        from: getSoutraliSmsSenderId(),
        statusCallback: deps.getSmsStatusCallbackUrl(),
      })

      return {
        delivered: true,
        to: result.to,
        sid: result.sid,
        body,
      }
    }
  }

  const twilioConfig = deps.getTwilioConfig()
  if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.from) {
    return {
      delivered: false,
      reason: "Twilio SMS is not fully configured",
    }
  }

  const result = await deps.sendSms({
    to: recipient,
    body,
    from: getSoutraliSmsSenderId(),
    statusCallback: deps.getSmsStatusCallbackUrl(),
  })

  return {
    delivered: true,
    to: result.to,
    sid: result.sid,
    body,
  }
}