const mocks = vi.hoisted(() => ({
  getMtnSmsConfig: vi.fn(() => ({
    consumerKey: "consumer-key",
    consumerSecret: "consumer-secret",
    tokenUrl: "https://api.mtn.com/v1/oauth/access_token/accesstoken?grant_type=client_credentials",
    baseUrl: "https://api.mtn.com/v2",
    senderAddress: "10111",
    notifyUrl: "https://afrisendiq.example.com/api/mtn/delivery-receipt",
    targetSystem: "MADAPI",
  })),
  isMtnSmsConfigured: vi.fn(() => true),
  subscribeMtnSmsDeliveryNotifications: vi.fn(async () => ({
    subscriptionId: "sub-1",
    resourceUrl: "https://api.mtn.com/v2/messages/sms/outbound/10111/subscription/sub-1",
    senderAddress: "10111",
    notifyUrl: "https://afrisendiq.example.com/api/mtn/delivery-receipt",
    targetSystem: "MADAPI",
  })),
}))

vi.mock("@/app/lib/mtnSms", () => ({
  getMtnSmsConfig: mocks.getMtnSmsConfig,
  isMtnSmsConfigured: mocks.isMtnSmsConfigured,
  subscribeMtnSmsDeliveryNotifications: mocks.subscribeMtnSmsDeliveryNotifications,
}))

import { GET, POST } from "@/app/api/internal/mtn/subscription/route"

describe("internal MTN subscription route", () => {
  beforeEach(() => {
    mocks.getMtnSmsConfig.mockClear()
    mocks.isMtnSmsConfigured.mockClear()
    mocks.subscribeMtnSmsDeliveryNotifications.mockClear()
  })

  it("returns the current MTN subscription config", async () => {
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      success: true,
      config: {
        configured: true,
        senderAddress: "10111",
        notifyUrl: "https://afrisendiq.example.com/api/mtn/delivery-receipt",
        targetSystem: "MADAPI",
      },
    })
  })

  it("creates an MTN delivery receipt subscription", async () => {
    const response = await POST()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.subscribeMtnSmsDeliveryNotifications).toHaveBeenCalledTimes(1)
    expect(payload).toMatchObject({
      success: true,
      subscription: {
        subscriptionId: "sub-1",
        senderAddress: "10111",
      },
    })
  })
})