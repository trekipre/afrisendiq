import {
  DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES,
  DEFAULT_STUCK_PAID_THRESHOLD_MINUTES,
  getManualBillingEscalations,
  normalizeThresholdMinutes
} from "@/app/lib/internalAlerts"

describe("internal manual billing alerts", () => {
  it("uses the provided fallback default when threshold input is invalid", () => {
    expect(normalizeThresholdMinutes(undefined, DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES)).toBe(DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES)
    expect(normalizeThresholdMinutes(undefined, DEFAULT_STUCK_PAID_THRESHOLD_MINUTES)).toBe(DEFAULT_STUCK_PAID_THRESHOLD_MINUTES)
  })

  it("returns quote requested and paid escalations independently", () => {
    const now = new Date("2026-03-28T12:00:00.000Z").getTime()

    const escalations = getManualBillingEscalations(
      [
        {
          id: "QUOTE-1",
          status: "quote_requested",
          updatedAt: "2026-03-28T11:30:00.000Z",
          service: "sodeci",
          customer: {
            customerName: "Mimose",
            customerEmail: "mimose@example.com",
            recipientName: "Family"
          }
        },
        {
          id: "PAID-1",
          status: "paid",
          updatedAt: "2026-03-28T11:20:00.000Z",
          service: "cie-postpaid",
          customer: {
            customerName: "Mimose",
            customerEmail: "mimose@example.com",
            recipientName: "Family"
          }
        }
      ],
      {
        quoteRequestedThresholdMinutes: 15,
        paidThresholdMinutes: 20,
        now,
      }
    )

    expect(escalations).toHaveLength(2)
    expect(escalations.find((entry) => entry.id === "QUOTE-1")?.escalationKind).toBe("quote_requested_sla")
    expect(escalations.find((entry) => entry.id === "PAID-1")?.escalationKind).toBe("paid_sla")
  })
})