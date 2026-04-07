export type TwilioInboundPayload = Record<string, string>

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function parseTwilioWebhookPayload(formData: URLSearchParams): TwilioInboundPayload {
  const payload: TwilioInboundPayload = {}

  for (const [key, value] of formData.entries()) {
    payload[key] = value
  }

  return payload
}

export function getTwilioInboundChannel(payload: TwilioInboundPayload): "sms" | "whatsapp" {
  const from = payload.From || ""
  const to = payload.To || ""

  if (from.startsWith("whatsapp:") || to.startsWith("whatsapp:")) {
    return "whatsapp"
  }

  return "sms"
}

export function normalizeTwilioAddress(value?: string) {
  return normalizeValue(value)?.replace(/^whatsapp:/, "")
}

export function collectTwilioMediaUrls(payload: TwilioInboundPayload) {
  const count = Number(payload.NumMedia || "0")

  if (!Number.isFinite(count) || count <= 0) {
    return []
  }

  const mediaUrls: string[] = []
  for (let index = 0; index < count; index += 1) {
    const mediaUrl = normalizeValue(payload[`MediaUrl${index}`])
    if (mediaUrl) {
      mediaUrls.push(mediaUrl)
    }
  }

  return mediaUrls
}

export function buildTwilioWebhookUrl(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${new URL(request.url).pathname}`
  }

  return request.url
}