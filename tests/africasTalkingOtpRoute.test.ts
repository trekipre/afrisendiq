export {}

const mocks = vi.hoisted(() => ({
  sendAfricasTalkingSmsMessage: vi.fn(async () => ({
    to: "+2250700000000",
    senderId: "SOUTRALI",
    messageId: "ATPid_otp_123",
    cost: "XOF 18.0000",
    status: "Success",
    statusCode: 100,
    summaryMessage: "Sent to 1/1 Total Cost: XOF 18.0000",
  })),
}))

vi.mock("@/app/lib/africasTalkingSms", () => ({
  sendAfricasTalkingSmsMessage: mocks.sendAfricasTalkingSmsMessage,
}))

describe("AfricasTalking internal OTP SMS route", () => {
  beforeEach(() => {
    mocks.sendAfricasTalkingSmsMessage.mockClear()
  })

  it("sends a branded OTP SMS through Africa's Talking", async () => {
    const { POST } = await import("@/app/api/internal/sms/otp/route")
    const request = new Request("https://afrisendiq.test/api/internal/sms/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+2250700000000",
        code: "123456",
        purpose: "sign-in",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendAfricasTalkingSmsMessage).toHaveBeenCalledWith({
      to: "+2250700000000",
      message: [
        "AfriSendIQ verification code: 123456",
        "Use it to finish your sign-in.",
        "Expires in 10 min. Do not share this code.",
        "afrisendiq.com",
      ].join("\n"),
    })
    expect(payload).toMatchObject({
      success: true,
      templateType: "otp",
      senderId: "SOUTRALI",
      status: "Success",
    })
  })

  it("returns 400 when the OTP code is invalid", async () => {
    const { POST } = await import("@/app/api/internal/sms/otp/route")
    const request = new Request("https://afrisendiq.test/api/internal/sms/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+2250700000000",
        code: "12",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toMatchObject({
      success: false,
      error: "OTP code must be at least 4 characters.",
    })
    expect(mocks.sendAfricasTalkingSmsMessage).not.toHaveBeenCalled()
  })
})