import { buildCustomerFulfillmentMessage, buildCustomerFulfillmentWhatsAppMessage, detectManualBillingSmsCarrier, getManualBillingSmsRouteMessageType, getMtnFallbackDecision, getOrangeFallbackDecision, getTwilioSmsFallbackDecision } from "@/app/lib/manualBillingNotifications"
import type { ManualBillingOrder } from "@/app/lib/manualBillingState"

function createCompletedOrder(): ManualBillingOrder {
  return {
    id: "CIE-1",
    traceId: "trace-1",
    service: "cie-prepaid",
    countryCode: "CI",
    accountReference: "24204634364",
    currency: "XOF",
    status: "completed",
    customer: {
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      customerPhone: "+2250700000000",
      recipientName: "Family",
    },
    metadata: {
      fulfillment: {
        deliveryMethod: "token",
        customerPhone: "+2250700000000",
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
    createdAt: "2026-03-30T09:00:00.000Z",
    updatedAt: "2026-03-30T10:00:00.000Z",
    transitions: [
      { from: null, to: "quote_requested", changedAt: "2026-03-30T09:00:00.000Z" },
      { from: "quote_requested", to: "completed", changedAt: "2026-03-30T10:00:00.000Z" },
    ],
  }
}

describe("manual billing notification fallback", () => {
  it("builds the requested CIE prepaid fulfillment message", () => {
    const order = createCompletedOrder()
    const message = buildCustomerFulfillmentMessage(order, order.metadata!.fulfillment!)

    expect(message).toContain("Soutrali: compteur CIE prepaye. De Mimose via AfriSendIQ.")
    expect(message).toContain("Token 1234-5678")
    expect(message).toContain("Ref CIE-1")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("builds the requested CIE postpaid fulfillment message", () => {
    const order: ManualBillingOrder = {
      ...createCompletedOrder(),
      id: "CIE-POST-1",
      service: "cie-postpaid",
      metadata: {
        fulfillment: {
          deliveryMethod: "confirmation",
          deliveredAt: "2026-03-30T10:00:00.000Z",
        },
      },
    }

    const message = buildCustomerFulfillmentMessage(order, order.metadata!.fulfillment!)

    expect(message).toContain("Soutrali: facture CIE payee. De Mimose via AfriSendIQ.")
    expect(message).toContain("Ref CIE-POST-1")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("builds the requested SODECI fulfillment message", () => {
    const order: ManualBillingOrder = {
      ...createCompletedOrder(),
      id: "SODECI-1",
      service: "sodeci",
      metadata: {
        fulfillment: {
          deliveryMethod: "confirmation",
          deliveredAt: "2026-03-30T10:00:00.000Z",
        },
      },
    }

    const message = buildCustomerFulfillmentMessage(order, order.metadata!.fulfillment!)

    expect(message).toContain("Soutrali: facture SODECI payee. De Mimose via AfriSendIQ.")
    expect(message).toContain("Ref SODECI-1")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("builds the requested Canal+ fulfillment message", () => {
    const order: ManualBillingOrder = {
      ...createCompletedOrder(),
      id: "CANAL-1",
      service: "canal-plus",
      packageLabel: "Canal+ Evasion",
      metadata: {
        fulfillment: {
          deliveryMethod: "confirmation",
          deliveredAt: "2026-03-30T10:00:00.000Z",
        },
      },
    }

    const message = buildCustomerFulfillmentMessage(order, order.metadata!.fulfillment!)

    expect(message).toContain("Soutrali: abo Canal+ Evasion. De Mimose via AfriSendIQ.")
    expect(message).toContain("Ref CANAL-1")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("keeps richer WhatsApp fulfillment copy", () => {
    const order: ManualBillingOrder = {
      ...createCompletedOrder(),
      id: "CANAL-WA-1",
      service: "canal-plus",
      packageLabel: "Canal+ Evasion",
      metadata: {
        fulfillment: {
          deliveryMethod: "confirmation",
          deliveredAt: "2026-03-30T10:00:00.000Z",
        },
      },
    }

    const message = buildCustomerFulfillmentWhatsAppMessage(order, order.metadata!.fulfillment!)

    expect(message).toContain("Vous avez recu un Soutrali d'abonnement Canal+ Evasion, par le service Soutrali d'AfriSendIQ, de la part de Mimose.")
    expect(message).toContain("Reference : CANAL-WA-1")
    expect(message).toContain("www.AfriSendIQ.com")
  })

  it("waits until the WhatsApp delay window has elapsed", () => {
    const order = createCompletedOrder()
    const decision = getOrangeFallbackDecision(order, {
      orangeFallbackEnabled: true,
      whatsappFallbackDelayMinutes: 15,
    }, new Date("2026-03-30T10:10:00.000Z"))

    expect(decision.eligible).toBe(false)
    expect(decision.reason).toContain("delay window")
  })

  it("becomes eligible once WhatsApp is still unread after the delay window", () => {
    const order = createCompletedOrder()
    const decision = getTwilioSmsFallbackDecision(order, {
      twilioSmsFallbackEnabled: true,
      whatsappFallbackDelayMinutes: 15,
    }, new Date("2026-03-30T10:20:00.000Z"))

    expect(decision.eligible).toBe(true)
  })

  it("makes Orange secondary eligible once the same unread-delay rule is met", () => {
    const order = createCompletedOrder()
    const decision = getOrangeFallbackDecision(order, {
      orangeFallbackEnabled: true,
      whatsappFallbackDelayMinutes: 15,
    }, new Date("2026-03-30T10:20:00.000Z"))

    expect(decision.eligible).toBe(true)
  })

  it("skips Orange fallback when the WhatsApp message was read", () => {
    const order = createCompletedOrder()
    order.metadata!.notifications!.whatsapp!.readAt = "2026-03-30T10:05:00.000Z"

    const decision = getOrangeFallbackDecision(order, {
      orangeFallbackEnabled: true,
      whatsappFallbackDelayMinutes: 15,
    }, new Date("2026-03-30T10:20:00.000Z"))

    expect(decision.eligible).toBe(false)
    expect(decision.reason).toContain("read")
  })

  it("makes MTN backup eligible on the same unread-delay rule", () => {
    const order = createCompletedOrder()
    const decision = getMtnFallbackDecision(order, {
      mtnFallbackEnabled: true,
      whatsappFallbackDelayMinutes: 15,
    }, new Date("2026-03-30T10:20:00.000Z"))

    expect(decision.eligible).toBe(true)
    expect(decision.reason).toContain("read receipt")
  })

  it("detects CI carrier from the customer phone prefix", () => {
    expect(detectManualBillingSmsCarrier("+2250500000000")).toBe("mtn-ci")
    expect(detectManualBillingSmsCarrier("+2250700000000")).toBe("orange-ci")
    expect(detectManualBillingSmsCarrier("+2250100000000")).toBe("moov-ci")
    expect(detectManualBillingSmsCarrier("+33123456789")).toBe("unknown-ci")
  })

  it("switches to retry routing after a prior SMS fallback attempt was recorded", () => {
    const order = createCompletedOrder()
    order.metadata!.notifications!.mtnFallback = {
      lastEvaluatedAt: "2026-03-30T10:25:00.000Z",
      skippedReason: "MTN provider unavailable",
    }

    expect(getManualBillingSmsRouteMessageType(order)).toBe("retry")
  })

  it("skips delayed fallback once a primary SMS has already been sent", () => {
    const order = createCompletedOrder()
    order.metadata!.notifications!.primarySms = {
      provider: "twilio",
      sentAt: "2026-03-30T10:06:00.000Z",
      status: "sent",
    }

    const decision = getTwilioSmsFallbackDecision(order, {
      twilioSmsFallbackEnabled: true,
      whatsappFallbackDelayMinutes: 15,
    }, new Date("2026-03-30T10:20:00.000Z"))

    expect(decision.eligible).toBe(false)
    expect(decision.reason).toContain("Primary SMS")
  })
})