export {}

const mocks = vi.hoisted(() => ({
  sendTwilioSmsMessage: vi.fn(async () => ({
    sid: "SM123456789",
    to: "+2250700000000",
    from: "SOUTRALI",
    status: "queued",
  })),
}))

vi.mock("@/app/lib/whatsapp", () => ({
  sendTwilioSmsMessage: mocks.sendTwilioSmsMessage,
}))

describe("Twilio internal SMS test route", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      TWILIO_SOUTRALI_SMS_SENDER_ID: "SOUTRALI",
    }
    mocks.sendTwilioSmsMessage.mockClear()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("prefers TWILIO_SOUTRALI_SMS_SENDER_ID when no explicit from is provided", async () => {
    const { POST } = await import("@/app/api/internal/sms/test/route")
    const request = new Request("https://afrisendiq.test/api/internal/sms/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+2250700000000",
        message: "hello from twilio test route",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendTwilioSmsMessage).toHaveBeenCalledWith({
      to: "+2250700000000",
      body: "hello from twilio test route",
      from: "SOUTRALI",
    })
    expect(payload).toMatchObject({
      success: true,
      from: "SOUTRALI",
      status: "queued",
    })
  })

  it("keeps an explicit request sender override ahead of the env var", async () => {
    const { POST } = await import("@/app/api/internal/sms/test/route")
    const request = new Request("https://afrisendiq.test/api/internal/sms/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+2250700000000",
        message: "hello from twilio test route",
        from: "+18334323693",
      }),
    })

    await POST(request)

    expect(mocks.sendTwilioSmsMessage).toHaveBeenCalledWith({
      to: "+2250700000000",
      body: "hello from twilio test route",
      from: "+18334323693",
    })
  })
})