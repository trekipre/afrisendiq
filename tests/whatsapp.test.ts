import { buildWhatsAppHref, getTwilioSmsConfig, getTwilioSmsStatusCallbackUrl, getTwilioWhatsAppStatusCallbackUrl, sendTwilioSmsMessage, sendTwilioWhatsAppMessage } from "@/app/lib/whatsapp"

const createMock = vi.fn(async () => ({ sid: "SM123456789" }))

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: createMock
    }
  }))
}))

describe("WhatsApp helper", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    createMock.mockClear()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("builds a wa.me handoff link from a phone number and message", () => {
    expect(buildWhatsAppHref("+2250700000000", "hello world")).toContain("wa.me/2250700000000")
  })

  it("builds a Twilio status callback URL from the public base URL", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://afrisendiq.com"

    expect(getTwilioWhatsAppStatusCallbackUrl()).toBe("https://afrisendiq.com/api/twilio/status")
    expect(getTwilioSmsStatusCallbackUrl()).toBe("https://afrisendiq.com/api/twilio/status")
  })

  it("derives the Twilio SMS sender from the WhatsApp sender when TWILIO_SMS_FROM is unset", () => {
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+18334323693"

    expect(getTwilioSmsConfig().from).toBe("+18334323693")
  })

  it("prefers TWILIO_SOUTRALI_SMS_SENDER_ID over the numeric sender when available", () => {
    process.env.TWILIO_SOUTRALI_SMS_SENDER_ID = "SOUTRALI"
    process.env.TWILIO_SMS_FROM = "+18334323693"
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+2250700000000"

    expect(getTwilioSmsConfig().from).toBe("SOUTRALI")
  })

  it("passes the Twilio status callback when sending WhatsApp", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+18334323693"

    await sendTwilioWhatsAppMessage({
      to: "+2250700000000",
      body: "hello",
      statusCallback: "https://afrisendiq.com/api/twilio/status",
    })

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      statusCallback: "https://afrisendiq.com/api/twilio/status",
      to: "whatsapp:+2250700000000",
    }))
  })

  it("sends WhatsApp templates with content variables when a content SID is provided", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+18334323693"

    await sendTwilioWhatsAppMessage({
      to: "+2250700000000",
      contentSid: "HX123456789",
      contentVariables: { "1": "bonjour" },
      messagingServiceSid: "MG123456789",
    })

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      contentSid: "HX123456789",
      contentVariables: JSON.stringify({ "1": "bonjour" }),
      messagingServiceSid: "MG123456789",
      to: "whatsapp:+2250700000000",
    }))
  })

  it("fails fast when WhatsApp delivery is still pointed at the Twilio sandbox sender", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886"

    await expect(sendTwilioWhatsAppMessage({
      to: "+2250700000000",
      body: "hello",
    })).rejects.toThrow("sandbox sender")

    expect(createMock).not.toHaveBeenCalled()
  })

  it("passes the Twilio status callback when sending SMS", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_SMS_FROM = "+18334323693"

    await sendTwilioSmsMessage({
      to: "+2250700000000",
      body: "hello",
      statusCallback: "https://afrisendiq.com/api/twilio/status",
    })

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      from: "+18334323693",
      statusCallback: "https://afrisendiq.com/api/twilio/status",
      to: "+2250700000000",
    }))
  })

  it("uses TWILIO_SOUTRALI_SMS_SENDER_ID by default when sending SMS", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_SOUTRALI_SMS_SENDER_ID = "SOUTRALI"
    process.env.TWILIO_SMS_FROM = "+18334323693"

    await sendTwilioSmsMessage({
      to: "+2250700000000",
      body: "hello",
    })

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      from: "SOUTRALI",
      to: "+2250700000000",
    }))
  })

  it("accepts an alphanumeric sender id override when sending SMS", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_SMS_FROM = "+18334323693"

    await sendTwilioSmsMessage({
      to: "+2250700000000",
      body: "bonjour",
      from: "SOUTRALI",
    })

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      from: "SOUTRALI",
      to: "+2250700000000",
    }))
  })

  it("preserves accented French content when sending SMS", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_SMS_FROM = "+18334323693"

    await sendTwilioSmsMessage({
      to: "+2250700000000",
      body: "Vous avez reçu. Référence : TEST. À utiliser sur AfriSendIQ.",
    })

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      body: "Vous avez reçu. Référence : TEST. À utiliser sur AfriSendIQ.",
      from: "+18334323693",
      to: "+2250700000000",
    }))
  })
})