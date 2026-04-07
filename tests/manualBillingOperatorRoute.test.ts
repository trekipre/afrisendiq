const mocks = vi.hoisted(() => ({
  advanceManualOrderOperatorState: vi.fn(async () => ({ id: "CIE-1", status: "completed" })),
}))

vi.mock("@/app/lib/manualBilling", () => ({
  advanceManualOrderOperatorState: mocks.advanceManualOrderOperatorState,
}))

import { POST } from "@/app/api/cote-divoire/manual-billing/[orderId]/operator/route"

describe("manual billing operator route", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      INTERNAL_DASHBOARD_USERNAME: "ops-afrisendiq",
      INTERNAL_DASHBOARD_PASSWORD: "secret-pass",
    }
    mocks.advanceManualOrderOperatorState.mockClear()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("rejects unauthorized operator calls in production", async () => {
    const request = new Request("https://afrisendiq.test/api/cote-divoire/manual-billing/CIE-1/operator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    })

    const response = await POST(request, { params: Promise.resolve({ orderId: "CIE-1" }) })
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toMatchObject({ success: false, error: "Unauthorized" })
    expect(mocks.advanceManualOrderOperatorState).not.toHaveBeenCalled()
  })

  it("allows authorized operator calls in production", async () => {
    const credentials = Buffer.from("ops-afrisendiq:secret-pass").toString("base64")
    const request = new Request("https://afrisendiq.test/api/cote-divoire/manual-billing/CIE-1/operator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        action: "complete",
        fulfillment: {
          customerPhone: "+2250700000000",
          token: "1234-5678",
          units: "42 kWh",
        },
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ orderId: "CIE-1" }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ success: true, order: { id: "CIE-1", status: "completed" } })
    expect(mocks.advanceManualOrderOperatorState).toHaveBeenCalledTimes(1)
  })
})