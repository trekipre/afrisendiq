import { getTpeCloudSmsConfig, isTpeCloudSmsConfigured, sendTpeCloudSmsMessage } from "@/app/lib/tpeCloudSms"

describe("TPECloud SMS helper", () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.TPE_CLOUD_SMS_API_KEY
    delete process.env.TPE_CLOUD_SMS_API_TOKEN
    delete process.env.TPE_CLOUD_SMS_BASE_URL
    delete process.env.TPE_CLOUD_SMS_FROM
    delete process.env.TPE_CLOUD_SMS_SENDER_ID
    delete process.env.TPE_CLOUD_SMS_ROUTE_ID
    delete process.env.TPE_CLOUD_SMS_ROTATE
    global.fetch = vi.fn()
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it("defaults the documented endpoint and disables rotation", () => {
    const config = getTpeCloudSmsConfig()

    expect(config.baseUrl).toBe("https://smsing.cloud/api/v2/SendSMS")
    expect(config.rotate).toBe(false)
    expect(config.flavor).toBe("legacy-v2")
  })

  it("switches to the panel API when an API token is configured", () => {
    process.env.TPE_CLOUD_SMS_API_TOKEN = "panel-token"

    const config = getTpeCloudSmsConfig()

    expect(config.baseUrl).toBe("https://panel.smsing.app/smsAPI")
    expect(config.flavor).toBe("panel-http")
  })

  it("treats placeholder values as not configured", () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "replace-with-api-key"
    process.env.TPE_CLOUD_SMS_FROM = "example-from"
    process.env.TPE_CLOUD_SMS_SENDER_ID = "SOUTRALI"

    expect(isTpeCloudSmsConfigured()).toBe(false)
  })

  it("requires a real api key and from sender", () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "live-key"
    process.env.TPE_CLOUD_SMS_FROM = "1234567890"
    process.env.TPE_CLOUD_SMS_SENDER_ID = "SOUTRALI"

    expect(isTpeCloudSmsConfigured()).toBe(true)
  })

  it("accepts LTECH as a valid temporary test sender id", () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "live-key"
    process.env.TPE_CLOUD_SMS_FROM = "1234567890"
    process.env.TPE_CLOUD_SMS_SENDER_ID = "LTECH"

    expect(isTpeCloudSmsConfigured()).toBe(true)
  })

  it("requires an API token and approved sender for the panel API", () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "live-key"
    process.env.TPE_CLOUD_SMS_API_TOKEN = "panel-token"
    process.env.TPE_CLOUD_SMS_SENDER_ID = "LTECH"

    expect(isTpeCloudSmsConfigured()).toBe(true)
  })

  it("sends the documented form payload and parses a successful response", async () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "live-key"
    process.env.TPE_CLOUD_SMS_FROM = "1234567890"
    process.env.TPE_CLOUD_SMS_SENDER_ID = "LTECH"
    process.env.TPE_CLOUD_SMS_ROTATE = "1"

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: vi.fn(async () => JSON.stringify({
        status: "987654321",
        msg: "Message accepted",
      })),
    } as unknown as Response)

    const result = await sendTpeCloudSmsMessage({
      to: "+225 0102030405",
      message: "  OTP 3456  ",
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://smsing.cloud/api/v2/SendSMS",
      expect.objectContaining({
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "apikey=live-key&from=1234567890&to=2250102030405&message=OTP+3456&alphasender=LTECH&rotate=1",
      })
    )

    expect(result).toEqual({
      to: "2250102030405",
      from: "1234567890",
      senderId: "LTECH",
      messageId: "987654321",
      status: "987654321",
      summaryMessage: "Message accepted",
    })
  })

  it("sends the panel API payload and parses queued responses", async () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "live-key"
    process.env.TPE_CLOUD_SMS_API_TOKEN = "panel-token"
    process.env.TPE_CLOUD_SMS_SENDER_ID = "LTECH"
    process.env.TPE_CLOUD_SMS_ROUTE_ID = "0"

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: vi.fn(async () => JSON.stringify({
        request: "sendsms",
        status: "queued",
        group_id: "1234",
        date: "2026-04-07 11:44:43",
      })),
    } as unknown as Response)

    const result = await sendTpeCloudSmsMessage({
      to: "+225 0102030405",
      message: "  OTP 3456  ",
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://panel.smsing.app/smsAPI?sendsms",
      expect.objectContaining({
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "apikey=live-key&apitoken=panel-token&type=sms&from=LTECH&to=2250102030405&text=OTP+3456&route=0",
      })
    )

    expect(result).toEqual({
      to: "2250102030405",
      from: "LTECH",
      senderId: "LTECH",
      messageId: "1234",
      status: "queued",
      summaryMessage: '{"request":"sendsms","status":"queued","group_id":"1234","date":"2026-04-07 11:44:43"}',
    })
  })

  it("surfaces panel API sender approval errors", async () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "live-key"
    process.env.TPE_CLOUD_SMS_API_TOKEN = "panel-token"
    process.env.TPE_CLOUD_SMS_SENDER_ID = "SOUTRALI"

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: vi.fn(async () => JSON.stringify({
        request: "sendsms",
        status: "error",
        message: "Sender ID not allowed",
      })),
    } as unknown as Response)

    await expect(sendTpeCloudSmsMessage({
      to: "+2250102030405",
      message: "OTP 3456",
    })).rejects.toThrow("Sender ID not allowed")
  })

  it("surfaces negative API statuses as errors", async () => {
    process.env.TPE_CLOUD_SMS_API_KEY = "live-key"
    process.env.TPE_CLOUD_SMS_FROM = "1234567890"

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: vi.fn(async () => JSON.stringify({
        status: "-7",
        msg: "Sender ID not approved",
      })),
    } as unknown as Response)

    await expect(sendTpeCloudSmsMessage({
      to: "+2250102030405",
      message: "OTP 3456",
    })).rejects.toThrow("Sender ID not approved")
  })
})