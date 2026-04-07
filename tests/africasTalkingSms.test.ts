import { getAfricasTalkingSmsConfig, isAfricasTalkingSmsConfigured, sendAfricasTalkingSmsMessage } from "@/app/lib/africasTalkingSms"

describe("AfricasTalking SMS helper", () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.AFRICAS_TALKING_USERNAME
    delete process.env.AFRICAS_TALKING_API_KEY
    delete process.env.AFRICAS_TALKING_SENDER_ID
    delete process.env.AFRICAS_TALKING_SMS_BASE_URL
    delete process.env.AFRICAS_TALKING_SMS_ENQUEUE
    global.fetch = vi.fn()
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it("defaults the bulk endpoint and enqueue to enabled", () => {
    const config = getAfricasTalkingSmsConfig()

    expect(config.baseUrl).toBe("https://api.africastalking.com/version1/messaging/bulk")
    expect(config.enqueue).toBe(true)
  })

  it("treats placeholder values as not configured", () => {
    process.env.AFRICAS_TALKING_USERNAME = "replace-with-username"
    process.env.AFRICAS_TALKING_API_KEY = "example-api-key"
    process.env.AFRICAS_TALKING_SENDER_ID = "your_sender_id"

    expect(isAfricasTalkingSmsConfigured()).toBe(false)
  })

  it("requires real credentials and sender id before the helper is configured", () => {
    process.env.AFRICAS_TALKING_USERNAME = "sandbox"
    process.env.AFRICAS_TALKING_API_KEY = "secret-key"
    process.env.AFRICAS_TALKING_SENDER_ID = "AFRISENDIQ"

    expect(isAfricasTalkingSmsConfigured()).toBe(true)
  })

  it("validates required config before sending", async () => {
    await expect(sendAfricasTalkingSmsMessage({
      to: "+2250700000000",
      message: "Hello",
    })).rejects.toThrow("AFRICAS_TALKING_USERNAME is required")
  })

  it("sends the documented JSON payload shape and normalizes the recipient", async () => {
    process.env.AFRICAS_TALKING_USERNAME = "sandbox"
    process.env.AFRICAS_TALKING_API_KEY = "secret-key"
    process.env.AFRICAS_TALKING_SENDER_ID = "AFRISENDIQ"
    process.env.AFRICAS_TALKING_SMS_ENQUEUE = "0"

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn(async () => ({
        SMSMessageData: {
          Message: "Sent to 1/1 Total Cost: XOF 25.00",
          Recipients: [
            {
              statusCode: 101,
              number: "+2250700000000",
              status: "Sent",
              cost: "XOF 25.00",
              messageId: "ATPid_1",
            },
          ],
        },
      })),
    } as unknown as Response)

    const result = await sendAfricasTalkingSmsMessage({
      to: "+225 0700000000",
      message: "  Hello from AfriSendIQ  ",
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.africastalking.com/version1/messaging/bulk",
      expect.objectContaining({
        method: "POST",
        headers: {
          apiKey: "secret-key",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "sandbox",
          message: "Hello from AfriSendIQ",
          senderId: "AFRISENDIQ",
          phoneNumbers: ["+2250700000000"],
          enqueue: false,
        }),
      })
    )

    expect(result).toEqual({
      to: "+2250700000000",
      senderId: "AFRISENDIQ",
      messageId: "ATPid_1",
      cost: "XOF 25.00",
      status: "Sent",
      statusCode: 101,
      summaryMessage: "Sent to 1/1 Total Cost: XOF 25.00",
    })
  })

  it("surfaces API errors when the send fails", async () => {
    process.env.AFRICAS_TALKING_USERNAME = "sandbox"
    process.env.AFRICAS_TALKING_API_KEY = "secret-key"
    process.env.AFRICAS_TALKING_SENDER_ID = "AFRISENDIQ"

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn(async () => ({ errorMessage: "Invalid senderId" })),
    } as unknown as Response)

    await expect(sendAfricasTalkingSmsMessage({
      to: "+2250700000000",
      message: "Hello",
    })).rejects.toThrow("Invalid senderId")
  })

  it("fails when the response payload does not contain a recipient", async () => {
    process.env.AFRICAS_TALKING_USERNAME = "sandbox"
    process.env.AFRICAS_TALKING_API_KEY = "secret-key"
    process.env.AFRICAS_TALKING_SENDER_ID = "AFRISENDIQ"

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn(async () => ({
        SMSMessageData: {
          Message: "No recipients available",
          Recipients: [],
        },
      })),
    } as unknown as Response)

    await expect(sendAfricasTalkingSmsMessage({
      to: "+2250700000000",
      message: "Hello",
    })).rejects.toThrow("No recipients available")
  })
})