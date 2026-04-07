import { getMtnSmsConfig, isMtnSmsConfigured } from "@/app/lib/mtnSms"

describe("MTN SMS helper", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.MTN_SMS_CONSUMER_KEY
    delete process.env.MTN_SMS_CONSUMER_SECRET
    delete process.env.MTN_SMS_SENDER_ADDRESS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("defaults the MTN SMS base URL and token URL", () => {
    const config = getMtnSmsConfig()
    expect(config.baseUrl).toBe("https://api.mtn.com/v2")
    expect(config.tokenUrl).toContain("grant_type=client_credentials")
  })

  it("requires real credentials and a sender address before MTN fallback is considered configured", () => {
    process.env.MTN_SMS_CONSUMER_KEY = "consumer-key"
    process.env.MTN_SMS_CONSUMER_SECRET = "consumer-secret"
    process.env.MTN_SMS_SENDER_ADDRESS = "10111"

    expect(isMtnSmsConfigured()).toBe(true)
  })
})