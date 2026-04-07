import { getOrangeSmsConfig, isOrangeSmsConfigured } from "@/app/lib/orangeSms"

describe("Orange SMS helper", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.ORANGE_SMS_CLIENT_ID
    delete process.env.ORANGE_SMS_CLIENT_SECRET
    delete process.env.ORANGE_SMS_SENDER_ADDRESS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("defaults the CIV sender address for Orange SMS", () => {
    expect(getOrangeSmsConfig().senderAddress).toBe("tel:+2250000")
  })

  it("requires real credentials before Orange fallback is considered configured", () => {
    process.env.ORANGE_SMS_CLIENT_ID = "client-id"
    process.env.ORANGE_SMS_CLIENT_SECRET = "client-secret"
    process.env.ORANGE_SMS_SENDER_ADDRESS = "tel:+2250000"

    expect(isOrangeSmsConfigured()).toBe(true)
  })
})