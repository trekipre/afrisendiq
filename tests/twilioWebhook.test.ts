import {
  collectTwilioMediaUrls,
  getTwilioInboundChannel,
  normalizeTwilioAddress,
  parseTwilioWebhookPayload,
} from "@/app/lib/twilioWebhook"

describe("Twilio webhook helpers", () => {
  it("parses URL-encoded payloads and detects WhatsApp channel", () => {
    const payload = parseTwilioWebhookPayload(new URLSearchParams("MessageSid=SM123&From=whatsapp%3A%2B2250700000000&To=whatsapp%3A%2B18334323693&NumMedia=0&Body=Hello"))

    expect(payload.MessageSid).toBe("SM123")
    expect(getTwilioInboundChannel(payload)).toBe("whatsapp")
    expect(normalizeTwilioAddress(payload.From)).toBe("+2250700000000")
  })

  it("collects media URLs from Twilio payload fields", () => {
    const mediaUrls = collectTwilioMediaUrls({
      NumMedia: "2",
      MediaUrl0: "https://example.com/0.jpg",
      MediaUrl1: "https://example.com/1.jpg"
    })

    expect(mediaUrls).toEqual(["https://example.com/0.jpg", "https://example.com/1.jpg"])
  })
})