const mocks = vi.hoisted(() => ({
  sendAfricasTalkingSmsMessage: vi.fn(async () => ({
    to: "+2250700000000",
    senderId: "AFRISENDIQ",
    messageId: "ATPid_123",
    cost: "XOF 25.00",
    status: "Sent",
    statusCode: 101,
    summaryMessage: "Sent to 1/1 Total Cost: XOF 25.00",
  })),
}))

vi.mock("@/app/lib/africasTalkingSms", () => ({
  sendAfricasTalkingSmsMessage: mocks.sendAfricasTalkingSmsMessage,
}))

describe("AfricasTalking internal SMS test route", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "development" }
    mocks.sendAfricasTalkingSmsMessage.mockClear()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("sends a development-only test SMS", async () => {
    const { POST } = await import("@/app/api/internal/sms/africas-talking-test/route")
    const request = new Request("https://afrisendiq.test/api/internal/sms/africas-talking-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+2250700000000",
        message: "hello from test route",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendAfricasTalkingSmsMessage).toHaveBeenCalledWith({
      to: "+2250700000000",
      message: "hello from test route",
    })
    expect(payload).toMatchObject({
      success: true,
      messageId: "ATPid_123",
      senderId: "AFRISENDIQ",
      status: "Sent",
    })
  })
})