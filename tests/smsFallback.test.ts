import { runManualBillingSmsFallbackEvaluation } from "@/app/lib/manualBilling"
import { createManualBillingOrder, resetManualBillingOrders, transitionManualBillingOrder } from "@/app/lib/manualBillingState"

const mocks = vi.hoisted(() => ({
  sendTpeCloudSmsMessage: vi.fn(async () => ({
    to: "2250100000000",
    from: "1234567890",
    senderId: "SOUTRALI",
    messageId: "TPE-1",
    status: "TPE-1",
    summaryMessage: "Message accepted",
  })),
  sendTwilioSmsMessage: vi.fn(async () => {
    throw new Error("Twilio provider unavailable")
  }),
  sendOrangeSmsMessage: vi.fn(async () => {
    throw new Error("Orange provider unavailable")
  }),
  sendMtnSmsMessage: vi.fn(async () => ({
    to: "2250700000000",
    senderAddress: "10111",
    requestId: "req-1",
    transactionId: "txn-1",
    clientCorrelator: "corr-1",
    status: "PENDING",
  })),
  sendAfricasTalkingSmsMessage: vi.fn(async () => ({
    to: "+2250700000000",
    senderId: "SOUTRALI",
    messageId: "ATPid_1",
    cost: "XOF 25.00",
    status: "Success",
    statusCode: 101,
    summaryMessage: "Sent to 1/1 Total Cost: XOF 25.00",
  })),
}))

vi.mock("@/app/lib/manualBillingSupabase", () => ({
  fetchManualBillingOrder: vi.fn(async () => null),
  listManualBillingAuditEvents: vi.fn(async () => []),
  listManualBillingOrdersFromSupabase: vi.fn(async () => []),
  persistManualBillingAuditEvent: vi.fn(async () => true),
  persistManualBillingOrder: vi.fn(async () => true)
}))

vi.mock("@/app/lib/internalSettings", () => ({
  getManualBillingAlertSettings: vi.fn(async () => ({
    quoteRequestedThresholdMinutes: 30,
    stuckPaidThresholdMinutes: 30,
    whatsappFallbackDelayMinutes: 15,
    tpeCloudFallbackEnabled: false,
    twilioSmsFallbackEnabled: true,
    orangeFallbackEnabled: true,
    mtnFallbackEnabled: true,
    africasTalkingFallbackEnabled: false,
    routingPolicy: {
      confirmation: {
        "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
        "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
        "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
      token: {
        "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
        "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
        "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
      receipt: {
        "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
        "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
        "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
      retry: {
        "mtn-ci": ["africasTalking", "twilio", "mtn", "orange"],
        "orange-ci": ["africasTalking", "twilio", "orange", "mtn"],
        "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
    },
    updatedAt: new Date().toISOString(),
    source: "fallback",
  }))
}))

vi.mock("@/app/lib/whatsapp", () => ({
  getTwilioSmsConfig: vi.fn(() => ({
    accountSid: "twilio-account-sid-test",
    authToken: "twilio-auth-token-test",
    from: "+18334323693",
  })),
  getTwilioSmsStatusCallbackUrl: vi.fn(() => "https://afrisendiq.com/api/twilio/status"),
  sendTwilioSmsMessage: mocks.sendTwilioSmsMessage,
}))

vi.mock("@/app/lib/tpeCloudSms", () => ({
  isTpeCloudSmsConfigured: vi.fn(() => true),
  sendTpeCloudSmsMessage: mocks.sendTpeCloudSmsMessage,
}))

vi.mock("@/app/lib/orangeSms", () => ({
  isOrangeSmsConfigured: vi.fn(() => true),
  sendOrangeSmsMessage: mocks.sendOrangeSmsMessage,
}))

vi.mock("@/app/lib/mtnSms", () => ({
  isMtnSmsConfigured: vi.fn(() => true),
  sendMtnSmsMessage: mocks.sendMtnSmsMessage,
}))

vi.mock("@/app/lib/africasTalkingSms", () => ({
  isAfricasTalkingSmsConfigured: vi.fn(() => true),
  sendAfricasTalkingSmsMessage: mocks.sendAfricasTalkingSmsMessage,
}))

describe("manual billing SMS fallback", () => {
  beforeEach(() => {
    resetManualBillingOrders()
    mocks.sendTpeCloudSmsMessage.mockClear()
    mocks.sendTwilioSmsMessage.mockClear()
    mocks.sendOrangeSmsMessage.mockClear()
    mocks.sendMtnSmsMessage.mockClear()
    mocks.sendAfricasTalkingSmsMessage.mockClear()
  })

  it("prefers MTN first for MTN CI token delivery", async () => {
    const created = createManualBillingOrder({
      id: "CIE-FALLBACK-1",
      traceId: "trace-fallback-1",
      service: "cie-prepaid",
      countryCode: "CI",
      accountReference: "24204634364",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        customerPhone: "+2250500000000",
        recipientName: "Family",
      },
      metadata: {
        fulfillment: {
          deliveryMethod: "token",
          customerPhone: "+2250500000000",
          token: "1234-5678",
          deliveredAt: "2026-03-30T10:00:00.000Z",
        },
        notifications: {
          whatsapp: {
            messageSid: "SM123",
            status: "delivered",
            statusRecordedAt: "2026-03-30T10:01:00.000Z",
          },
        },
      },
    })

    const quoteReady = transitionManualBillingOrder(created, "quote_ready", {}, "Ready")
    const paymentPending = transitionManualBillingOrder(quoteReady, "payment_pending", {}, "Pending")
    const paid = transitionManualBillingOrder(paymentPending, "paid", {}, "Paid")
    const started = transitionManualBillingOrder(paid, "operator_started", {}, "Started")
    const confirmed = transitionManualBillingOrder(started, "operator_confirmed", {}, "Confirmed")
    transitionManualBillingOrder(confirmed, "completed", {}, "Completed")

    const result = await runManualBillingSmsFallbackEvaluation({
      now: new Date("2099-03-30T10:20:00.000Z"),
    })

    expect(mocks.sendTwilioSmsMessage).not.toHaveBeenCalled()
    expect(mocks.sendOrangeSmsMessage).not.toHaveBeenCalled()
    expect(mocks.sendMtnSmsMessage).toHaveBeenCalledTimes(1)
    expect(result.summary.sent).toBe(1)
    expect(result.results[0]).toMatchObject({
      orderId: "CIE-FALLBACK-1",
      action: "sent",
      provider: "mtn",
      requestId: "req-1",
    })
  })

  it("uses AfricasTalking first on retry for an MTN route after a recorded failed attempt", async () => {
    const created = createManualBillingOrder({
      id: "CIE-FALLBACK-AT-1",
      traceId: "trace-fallback-at-1",
      service: "cie-prepaid",
      countryCode: "CI",
      accountReference: "24204634364",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        customerPhone: "+2250500000000",
        recipientName: "Family",
      },
      metadata: {
        fulfillment: {
          deliveryMethod: "token",
          customerPhone: "+2250500000000",
          token: "1234-5678",
          deliveredAt: "2026-03-30T10:00:00.000Z",
        },
        notifications: {
          whatsapp: {
            messageSid: "SM123",
            status: "delivered",
            statusRecordedAt: "2026-03-30T10:01:00.000Z",
          },
          mtnFallback: {
            lastEvaluatedAt: "2026-03-30T10:18:00.000Z",
            skippedReason: "MTN provider unavailable",
          },
        },
      },
    })

    const quoteReady = transitionManualBillingOrder(created, "quote_ready", {}, "Ready")
    const paymentPending = transitionManualBillingOrder(quoteReady, "payment_pending", {}, "Pending")
    const paid = transitionManualBillingOrder(paymentPending, "paid", {}, "Paid")
    const started = transitionManualBillingOrder(paid, "operator_started", {}, "Started")
    const confirmed = transitionManualBillingOrder(started, "operator_confirmed", {}, "Confirmed")
    transitionManualBillingOrder(confirmed, "completed", {}, "Completed")

    const result = await runManualBillingSmsFallbackEvaluation({
      now: new Date("2099-03-30T10:20:00.000Z"),
      settingsOverride: {
        africasTalkingFallbackEnabled: true,
      },
    })

    expect(mocks.sendTwilioSmsMessage).not.toHaveBeenCalled()
    expect(mocks.sendOrangeSmsMessage).not.toHaveBeenCalled()
    expect(mocks.sendMtnSmsMessage).not.toHaveBeenCalled()
    expect(mocks.sendAfricasTalkingSmsMessage).toHaveBeenCalledTimes(1)
    expect(result.summary.sent).toBe(1)
    expect(result.results[0]).toMatchObject({
      orderId: "CIE-FALLBACK-AT-1",
      action: "sent",
      provider: "africasTalking",
      messageId: "ATPid_1",
      cost: "XOF 25.00",
    })
  })

  it("uses TPECloud when explicitly enabled and routed first for Moov CI", async () => {
    const created = createManualBillingOrder({
      id: "CIE-FALLBACK-TPE-1",
      traceId: "trace-fallback-tpe-1",
      service: "cie-prepaid",
      countryCode: "CI",
      accountReference: "24204634364",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        customerPhone: "+2250100000000",
        recipientName: "Family",
      },
      metadata: {
        fulfillment: {
          deliveryMethod: "token",
          customerPhone: "+2250100000000",
          token: "1234-5678",
          deliveredAt: "2026-03-30T10:00:00.000Z",
        },
        notifications: {
          whatsapp: {
            messageSid: "SM123",
            status: "delivered",
            statusRecordedAt: "2026-03-30T10:01:00.000Z",
          },
        },
      },
    })

    const quoteReady = transitionManualBillingOrder(created, "quote_ready", {}, "Ready")
    const paymentPending = transitionManualBillingOrder(quoteReady, "payment_pending", {}, "Pending")
    const paid = transitionManualBillingOrder(paymentPending, "paid", {}, "Paid")
    const started = transitionManualBillingOrder(paid, "operator_started", {}, "Started")
    const confirmed = transitionManualBillingOrder(started, "operator_confirmed", {}, "Confirmed")
    transitionManualBillingOrder(confirmed, "completed", {}, "Completed")

    const routingPolicy = {
      confirmation: {
        "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
        "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
        "moov-ci": ["tpeCloud", "twilio", "africasTalking"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
      token: {
        "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
        "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
        "moov-ci": ["tpeCloud", "twilio", "africasTalking"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
      receipt: {
        "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
        "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
        "moov-ci": ["tpeCloud", "twilio", "africasTalking"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
      retry: {
        "mtn-ci": ["africasTalking", "twilio", "mtn", "orange"],
        "orange-ci": ["africasTalking", "twilio", "orange", "mtn"],
        "moov-ci": ["tpeCloud", "twilio", "africasTalking"],
        "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
      },
    } as const

    const result = await runManualBillingSmsFallbackEvaluation({
      now: new Date("2099-03-30T10:20:00.000Z"),
      settingsOverride: {
        tpeCloudFallbackEnabled: true,
        routingPolicy: routingPolicy as never,
      },
    })

    expect(mocks.sendTpeCloudSmsMessage).toHaveBeenCalledTimes(1)
    expect(mocks.sendTwilioSmsMessage).not.toHaveBeenCalled()
    expect(result.summary.sent).toBe(1)
    expect(result.results[0]).toMatchObject({
      orderId: "CIE-FALLBACK-TPE-1",
      action: "sent",
      provider: "tpeCloud",
      messageId: "TPE-1",
    })
  })
})