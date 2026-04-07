const mocks = vi.hoisted(() => ({
  sendTpeCloudSmsMessage: vi.fn(async () => ({
    to: "2250102030405",
    from: "1234567890",
    senderId: "LTECH",
    messageId: "TPE-123",
    status: "TPE-123",
    summaryMessage: "Message accepted",
  })),
}))

vi.mock("@/app/lib/tpeCloudSms", () => ({
  sendTpeCloudSmsMessage: mocks.sendTpeCloudSmsMessage,
}))

describe("TPECloud internal SMS test route", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "development" }
    mocks.sendTpeCloudSmsMessage.mockClear()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("sends a development-only test SMS", async () => {
    const { POST } = await import("@/app/api/internal/sms/tpecloud-test/route")
    const request = new Request("https://afrisendiq.test/api/internal/sms/tpecloud-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+2250102030405",
        message: "bonjour depuis tpecloud",
        senderId: "LTECH",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendTpeCloudSmsMessage).toHaveBeenCalledWith({
      to: "+2250102030405",
      message: "bonjour depuis tpecloud",
      from: undefined,
      senderId: "LTECH",
    })
    expect(payload).toMatchObject({
      success: true,
      messageId: "TPE-123",
      senderId: "LTECH",
      status: "TPE-123",
    })
  })
})