import { recordManualOrderAfricasTalkingFallbackStatus } from "@/app/lib/manualBilling"
import { createManualBillingOrder, getManualBillingOrder, resetManualBillingOrders } from "@/app/lib/manualBillingState"

const mocks = vi.hoisted(() => ({
  recordInboundWebhookEvent: vi.fn(async () => true),
}))

vi.mock("@/app/lib/manualBillingSupabase", () => ({
  fetchManualBillingOrder: vi.fn(async () => null),
  listManualBillingAuditEvents: vi.fn(async () => []),
  listManualBillingOrdersFromSupabase: vi.fn(async () => []),
  persistManualBillingAuditEvent: vi.fn(async () => true),
  persistManualBillingOrder: vi.fn(async () => true)
}))

vi.mock("@/app/lib/webhookEventSupabase", () => ({
  recordInboundWebhookEvent: mocks.recordInboundWebhookEvent,
}))

describe("AfricasTalking delivery reports", () => {
  beforeEach(() => {
    resetManualBillingOrders()
    mocks.recordInboundWebhookEvent.mockClear()
  })

  it("records the delivery report status on the matching manual order", async () => {
    createManualBillingOrder({
      id: "CIE-AT-1",
      traceId: "trace-at-1",
      service: "cie-prepaid",
      countryCode: "CI",
      accountReference: "24204634364",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        customerPhone: "+2250700000000",
        recipientName: "Family"
      },
      metadata: {
        notifications: {
          africasTalkingFallback: {
            enabled: true,
            messageId: "ATPid_1",
            status: "Sent"
          }
        }
      }
    })

    const updated = await recordManualOrderAfricasTalkingFallbackStatus({
      messageId: "ATPid_1",
      status: "Success",
      payload: {
        id: "ATPid_1",
        status: "Success",
        phoneNumber: "+2250700000000",
      },
    })

    expect(updated?.metadata?.notifications?.africasTalkingFallback?.status).toBe("Success")
    expect(updated?.metadata?.notifications?.africasTalkingFallback?.target).toBe("+2250700000000")
  })

  it("accepts form-urlencoded delivery reports through the route", async () => {
    const { POST } = await import("@/app/api/africastalking/delivery-report/route")

    createManualBillingOrder({
      id: "CIE-AT-2",
      traceId: "trace-at-2",
      service: "cie-prepaid",
      countryCode: "CI",
      accountReference: "24204634364",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        customerPhone: "+2250700000000",
        recipientName: "Family"
      },
      metadata: {
        notifications: {
          africasTalkingFallback: {
            enabled: true,
            messageId: "ATPid_2",
            status: "Sent"
          }
        }
      }
    })

    const request = new Request("https://afrisendiq.test/api/africastalking/delivery-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id: "ATPid_2",
        status: "Failed",
        phoneNumber: "+2250700000000",
        failureReason: "DeliveryFailure",
      }).toString(),
    })

    const response = await POST(request)
    const payload = await response.json()
    const updated = getManualBillingOrder("CIE-AT-2")

    expect(response.status).toBe(200)
    expect(payload).toEqual({ success: true })
    expect(mocks.recordInboundWebhookEvent).toHaveBeenCalledWith({
      provider: "africastalking",
      eventId: "ATPid_2",
      eventType: "delivery_report.Failed",
      domainType: "provider",
      domainReference: "+2250700000000",
      payload: {
        id: "ATPid_2",
        status: "Failed",
        phoneNumber: "+2250700000000",
        failureReason: "DeliveryFailure",
      },
    })
    expect(updated?.metadata?.notifications?.africasTalkingFallback?.summaryMessage).toBe("DeliveryFailure")
  })
})