export {}

const mocks = vi.hoisted(() => ({
  getTwilioWhatsAppStatusCallbackUrl: vi.fn(() => "https://afrisendiq.com/api/twilio/status"),
  sendTwilioWhatsAppMessage: vi.fn(async () => ({
    sid: "SMWA123456789",
    to: "+17192319434",
    from: "whatsapp:+18334323693",
    whatsappHref: "https://wa.me/17192319434?text=hello",
  })),
}))

vi.mock("@/app/lib/whatsapp", () => ({
  getTwilioWhatsAppStatusCallbackUrl: mocks.getTwilioWhatsAppStatusCallbackUrl,
  sendTwilioWhatsAppMessage: mocks.sendTwilioWhatsAppMessage,
}))

describe("Twilio internal WhatsApp test route", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    mocks.getTwilioWhatsAppStatusCallbackUrl.mockClear()
    mocks.sendTwilioWhatsAppMessage.mockClear()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("uses the configured WhatsApp template when a content SID is present", async () => {
    process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID = "HX_CONFIRM_TEMPLATE"
    process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID = "MG_CONFIRM_SERVICE"

    const { POST } = await import("@/app/api/internal/whatsapp/test/route")
    const request = new Request("https://afrisendiq.test/api/internal/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+17192319434",
        message: "Soutrali by AfriSendIQ: WhatsApp verification check.",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendTwilioWhatsAppMessage).toHaveBeenCalledWith({
      to: "+17192319434",
      contentSid: "HX_CONFIRM_TEMPLATE",
      contentVariables: { "1": "Soutrali by AfriSendIQ: WhatsApp verification check." },
      messagingServiceSid: "MG_CONFIRM_SERVICE",
      statusCallback: "https://afrisendiq.com/api/twilio/status",
    })
    expect(payload).toMatchObject({
      success: true,
      templateSid: "HX_CONFIRM_TEMPLATE",
    })
  })

  it("prefers dedicated WhatsApp test template env vars when present", async () => {
    process.env.TWILIO_WHATSAPP_TEST_CONTENT_SID = "HX_TEST_TEMPLATE"
    process.env.TWILIO_WHATSAPP_TEST_MESSAGING_SERVICE_SID = "MG_TEST_SERVICE"
    process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID = "HX_CONFIRM_TEMPLATE"
    process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID = "MG_CONFIRM_SERVICE"

    const { POST } = await import("@/app/api/internal/whatsapp/test/route")
    const request = new Request("https://afrisendiq.test/api/internal/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+17192319434",
        message: "Soutrali by AfriSendIQ: WhatsApp verification check.",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendTwilioWhatsAppMessage).toHaveBeenCalledWith({
      to: "+17192319434",
      contentSid: "HX_TEST_TEMPLATE",
      contentVariables: { "1": "Soutrali by AfriSendIQ: WhatsApp verification check." },
      messagingServiceSid: "MG_TEST_SERVICE",
      statusCallback: "https://afrisendiq.com/api/twilio/status",
    })
    expect(payload).toMatchObject({
      success: true,
      templateSid: "HX_TEST_TEMPLATE",
    })
  })

  it("falls back to a freeform body when no template SID is configured", async () => {
    delete process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID
    delete process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID

    const { POST } = await import("@/app/api/internal/whatsapp/test/route")
    const request = new Request("https://afrisendiq.test/api/internal/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+17192319434",
        message: "Soutrali by AfriSendIQ: WhatsApp verification check.",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendTwilioWhatsAppMessage).toHaveBeenCalledWith({
      to: "+17192319434",
      body: "Soutrali by AfriSendIQ: WhatsApp verification check.",
      statusCallback: "https://afrisendiq.com/api/twilio/status",
    })
    expect(payload).toMatchObject({
      success: true,
    })
    expect(payload.templateSid).toBeUndefined()
  })

  it("fails closed in production when no WhatsApp template SID is configured", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.TWILIO_WHATSAPP_TEST_CONTENT_SID
    delete process.env.TWILIO_WHATSAPP_TEST_MESSAGING_SERVICE_SID
    delete process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID
    delete process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID

    const { POST } = await import("@/app/api/internal/whatsapp/test/route")
    const request = new Request("https://afrisendiq.test/api/internal/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+17192319434",
        message: "Soutrali by AfriSendIQ: WhatsApp verification check.",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(mocks.sendTwilioWhatsAppMessage).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      success: false,
    })
    expect(String(payload.error || "")).toContain("TWILIO_WHATSAPP_TEST_CONTENT_SID")
  })
})