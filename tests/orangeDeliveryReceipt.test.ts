import { recordManualOrderOrangeFallbackStatus } from "@/app/lib/manualBilling"
import { createManualBillingOrder, resetManualBillingOrders } from "@/app/lib/manualBillingState"

vi.mock("@/app/lib/manualBillingSupabase", () => ({
  fetchManualBillingOrder: vi.fn(async () => null),
  listManualBillingAuditEvents: vi.fn(async () => []),
  listManualBillingOrdersFromSupabase: vi.fn(async () => []),
  persistManualBillingAuditEvent: vi.fn(async () => true),
  persistManualBillingOrder: vi.fn(async () => true)
}))

describe("Orange delivery receipt tracking", () => {
  beforeEach(() => {
    resetManualBillingOrders()
  })

  it("records Orange delivery receipt status on the matching manual order", async () => {
    createManualBillingOrder({
      id: "CIE-ORANGE-1",
      traceId: "trace-orange-1",
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
          orangeFallback: {
            enabled: true,
            resourceId: "orange-resource-1",
            status: "sent"
          }
        }
      }
    })

    const updated = await recordManualOrderOrangeFallbackStatus({
      resourceId: "orange-resource-1",
      status: "DeliveredToTerminal"
    })

    expect(updated?.metadata?.notifications?.orangeFallback?.status).toBe("DeliveredToTerminal")
  })
})