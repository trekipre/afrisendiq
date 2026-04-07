import {
  advanceManualOrderOperatorState,
  createManualOrder,
  createManualCheckoutSession,
  getManualOrder,
  listCiePrepaidAmountOptions,
  markManualOrderPaid,
  presentManualOrder,
  recordManualOrderAuditEvent,
  resendManualOrderSmsDelivery,
  runManualBillingOpsTestHook,
  runManualBillingSmsFallbackEvaluation,
  setManualQuote
} from "@/app/lib/manualBilling"
import { stripePaymentService } from "@/app/lib/services/paymentService"
import { sendTwilioWhatsAppMessage } from "@/app/lib/whatsapp"
import {
  createManualBillingOrder,
  resetManualBillingOrders,
  transitionManualBillingOrder
} from "@/app/lib/manualBillingState"

vi.mock("@/app/lib/manualBillingSupabase", () => ({
  fetchManualBillingOrder: vi.fn(async () => null),
  listManualBillingAuditEvents: vi.fn(async () => []),
  listManualBillingOrdersFromSupabase: vi.fn(async () => []),
  persistManualBillingAuditEvent: vi.fn(async () => true),
  persistManualBillingOrder: vi.fn(async () => true)
}))

vi.mock("@/app/lib/services/paymentService", () => ({
  stripePaymentService: {
    createCheckoutSession: vi.fn(async (input: { orderId: string; amount: number; currency: string }) => ({
      provider: "stripe",
      paymentId: `cs_test_${input.orderId}`,
      status: "created",
      amount: input.amount,
      currency: input.currency,
      checkoutUrl: `https://checkout.stripe.test/${input.orderId}`,
    }))
  }
}))

vi.mock("@/app/lib/whatsapp", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/whatsapp")>("@/app/lib/whatsapp")

  return {
    ...actual,
    sendTwilioWhatsAppMessage: vi.fn(async ({ to, body }: { to: string; body: string }) => ({
      sid: "SM_WHATSAPP_TEST",
      to,
      from: "whatsapp:+14155238886",
      whatsappHref: actual.buildWhatsAppHref(to, body),
    })),
    sendTwilioSmsMessage: vi.fn(async ({ to }: { to: string }) => ({
      sid: "SM_TWILIO_SMS_TEST",
      to,
      from: "+18334323693",
      status: "sent",
    }))
  }
})

describe("manual billing operator actions", () => {
  beforeEach(() => {
    resetManualBillingOrders()
    delete process.env.MANUAL_BILLING_AUTO_COMPLETE_SERVICES
    delete process.env.MANUAL_BILLING_LOOKUP_FIXTURES
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "live_test_token"
    process.env.TWILIO_SMS_FROM = "+18334323693"
  })

  it("advances paid orders through operator states from the admin API path", async () => {
    const created = createManualBillingOrder({
      id: "SODECI-OP-1",
      traceId: "trace-op-1",
      service: "sodeci",
      countryCode: "CI",
      accountReference: "027009680",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    const quoteReady = transitionManualBillingOrder(created, "quote_ready", { quotedAmount: 1000 }, "Bill looked up")
    const paymentPending = transitionManualBillingOrder(quoteReady, "payment_pending", { paymentSessionId: "cs_live_1" }, "Stripe checkout created")
    const paid = transitionManualBillingOrder(paymentPending, "paid", { stripePaymentStatus: "paid" }, "Stripe payment confirmed")

    const started = await advanceManualOrderOperatorState(paid.id, "start", {
      source: "admin",
      adminExecutionNotes: "Operator picked up the order"
    })
    const confirmed = await advanceManualOrderOperatorState(started.id, "confirm", {
      source: "admin"
    })
    const completed = await advanceManualOrderOperatorState(confirmed.id, "complete", {
      source: "admin"
    })

    expect(started.status).toBe("operator_started")
    expect(confirmed.status).toBe("operator_confirmed")
    expect(completed.status).toBe("completed")
    expect(completed.adminExecutionNotes).toBe("Operator picked up the order")
    expect(completed.transitions.at(-1)?.to).toBe("completed")
  })

  it("auto-completes configured services after payment confirmation", async () => {
    process.env.MANUAL_BILLING_AUTO_COMPLETE_SERVICES = "sodeci"

    const created = createManualBillingOrder({
      id: "SODECI-AUTO-1",
      traceId: "trace-auto-1",
      service: "sodeci",
      countryCode: "CI",
      accountReference: "027009680",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    const quoteReady = transitionManualBillingOrder(created, "quote_ready", { quotedAmount: 1000 }, "Bill looked up")
    const paymentPending = transitionManualBillingOrder(quoteReady, "payment_pending", { paymentSessionId: "cs_live_2" }, "Stripe checkout created")

    const completed = await markManualOrderPaid(paymentPending.id, "cs_live_2")

    expect(completed.status).toBe("completed")
    expect(completed.stripePaymentStatus).toBe("paid")
    expect(completed.transitions.map((transition) => transition.to)).toEqual([
      "quote_requested",
      "quote_ready",
      "payment_pending",
      "paid",
      "operator_started",
      "operator_confirmed",
      "completed"
    ])
  })

  it("records explicit Telegram delivery audit events on order creation", async () => {
    const created = await createManualOrder({
      service: "canal-plus",
      accountReference: "027009680",
      packageCode: "evasion",
      packageLabel: "Canal+ Evasion",
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      recipientName: "Family"
    })

    const presented = presentManualOrder(created)

    expect(presented.pricingSummary?.inputAmount).toBe(10000)
    expect(presented.pricingSummary?.customerPrice).toBeGreaterThan(10000)
    expect(presented.quotedAmount).toBe(presented.pricingSummary?.customerPrice)
    expect(presented.auditEvents.some((event) => event.channel === "system" && event.event === "manual_billing.order_created")).toBe(true)
    expect(presented.auditEvents.some((event) => event.channel === "telegram_send" && event.outcome === "skipped")).toBe(true)
  })

  it("prices CIE prepaid manual requests immediately from the selected amount option", async () => {
    const amountOption = listCiePrepaidAmountOptions()[1]

    const created = await createManualOrder({
      service: "cie-prepaid",
      accountReference: "2420 4634 364",
      packageCode: amountOption.code,
      packageLabel: amountOption.label,
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      recipientName: "Family"
    })

    expect(created.status).toBe("quote_ready")
    expect(created.pricingSummary?.inputAmount).toBe(amountOption.amount)
    expect(created.quotedAmount).toBeGreaterThan(amountOption.amount)
    expect(created.metadata?.normalizedAccountReference).toBe("24204634364")
  })

  it("captures CIE prepaid fulfillment details and prepares WhatsApp handoff on completion", async () => {
    const amountOption = listCiePrepaidAmountOptions()[0]

    const created = await createManualOrder({
      service: "cie-prepaid",
      accountReference: "2420 4634 364",
      packageCode: amountOption.code,
      packageLabel: amountOption.label,
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      customerPhone: "+2250700000000",
      recipientName: "Family"
    })

    const paymentPending = transitionManualBillingOrder(created, "payment_pending", { paymentSessionId: "cs_manual_1" }, "Stripe checkout created")
    const paid = transitionManualBillingOrder(paymentPending, "paid", { stripePaymentStatus: "paid" }, "Stripe payment confirmed")

    const started = await advanceManualOrderOperatorState(paid.id, "start", { source: "admin" })
    const confirmed = await advanceManualOrderOperatorState(started.id, "confirm", { source: "admin" })
    const completed = await advanceManualOrderOperatorState(confirmed.id, "complete", {
      source: "admin",
      adminExecutionNotes: "Token verified by operator",
      fulfillment: {
        customerPhone: "+2250700000000",
        token: "1234-5678-9000",
        units: "47.8 kWh",
        note: "Share with customer after meter confirmation"
      }
    })

    const presented = presentManualOrder(completed)

    expect(completed.status).toBe("completed")
    expect(completed.metadata?.fulfillment?.token).toBe("1234-5678-9000")
    expect(completed.metadata?.fulfillment?.units).toBe("47.8 kWh")
    expect(completed.metadata?.fulfillment?.whatsappHref).toContain("wa.me")
    expect(presented.auditEvents.some((event) => event.channel === "whatsapp_send" && ["processed", "delivered"].includes(event.outcome))).toBe(true)
  })

  it("returns CIE prepaid customers to the live prepaid page after Stripe checkout", async () => {
    const amountOption = listCiePrepaidAmountOptions()[0]

    const created = await createManualOrder({
      service: "cie-prepaid",
      accountReference: "24204634364",
      packageCode: amountOption.code,
      packageLabel: amountOption.label,
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      recipientName: "Family"
    })

    await createManualCheckoutSession(created.id)

    expect(vi.mocked(stripePaymentService.createCheckoutSession)).toHaveBeenCalledWith(expect.objectContaining({
      successUrl: expect.stringContaining(`/cote-divoire/cie-prepaid?orderId=${created.id}&payment=success`),
      cancelUrl: expect.stringContaining(`/cote-divoire/cie-prepaid?orderId=${created.id}&payment=cancelled`),
    }))
  })

  it("allows fallback evaluation with temporary settings and an override clock", async () => {
    const amountOption = listCiePrepaidAmountOptions()[0]

    const created = await createManualOrder({
      service: "cie-prepaid",
      accountReference: "24204634364",
      packageCode: amountOption.code,
      packageLabel: amountOption.label,
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      customerPhone: "+2250700000000",
      recipientName: "Family"
    })

    const paymentPending = await createManualCheckoutSession(created.id)
    const paid = await markManualOrderPaid(paymentPending.order.id, paymentPending.order.paymentSessionId)
    const started = await advanceManualOrderOperatorState(paid.id, "start", { source: "admin" })
    const confirmed = await advanceManualOrderOperatorState(started.id, "confirm", { source: "admin" })
    const completed = await advanceManualOrderOperatorState(confirmed.id, "complete", {
      source: "admin",
      fulfillment: {
        customerPhone: "+2250700000000",
        token: "1234-5678",
        units: "42 kWh"
      }
    })

    const evaluated = await runManualBillingSmsFallbackEvaluation({
      dryRun: false,
      now: new Date(new Date(completed.updatedAt).getTime() + 16 * 60_000),
      settingsOverride: {
        twilioSmsFallbackEnabled: true,
        orangeFallbackEnabled: false,
        mtnFallbackEnabled: false,
        whatsappFallbackDelayMinutes: 15,
      }
    })

    expect(evaluated.summary.sent).toBe(1)
    expect(evaluated.results.find((result) => result.orderId === completed.id)).toMatchObject({
      action: "sent",
      provider: "twilio",
      messageSid: "SM_TWILIO_SMS_TEST"
    })
  })

  it("runs the internal ops test hook through payment and fallback execution", async () => {
    const amountOption = listCiePrepaidAmountOptions()[0]

    const result = await runManualBillingOpsTestHook({
      createOrder: {
        service: "cie-prepaid",
        accountReference: "24204634364",
        packageCode: amountOption.code,
        packageLabel: amountOption.label,
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        customerPhone: "+2250700000000",
        recipientName: "Family"
      },
      createCheckoutSession: true,
      markPaid: true,
      autoProgress: true,
      fulfillment: {
        customerPhone: "+2250700000000",
        token: "1234-5678",
        units: "42 kWh"
      },
      fallback: {
        dryRun: false,
        overrideNow: new Date(Date.now() + 16 * 60_000),
        settingsOverride: {
          twilioSmsFallbackEnabled: true,
          orangeFallbackEnabled: false,
          mtnFallbackEnabled: false,
          whatsappFallbackDelayMinutes: 15,
        }
      }
    })

    expect(result.order.status).toBe("completed")
    expect(result.fallbackMatch).toMatchObject({
      action: "sent",
      provider: "twilio",
      messageSid: "SM_TWILIO_SMS_TEST"
    })
  })

  it("resends a primary SMS delivery for a completed order", async () => {
    const amountOption = listCiePrepaidAmountOptions()[0]

    vi.mocked(sendTwilioWhatsAppMessage).mockRejectedValueOnce(new Error("WhatsApp temporarily unavailable"))

    const created = await createManualOrder({
      service: "cie-prepaid",
      accountReference: "24204634364",
      packageCode: amountOption.code,
      packageLabel: amountOption.label,
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      customerPhone: "+2250700000000",
      recipientName: "Family"
    })

    const paymentPending = await createManualCheckoutSession(created.id)
    const paid = await markManualOrderPaid(paymentPending.order.id, paymentPending.order.paymentSessionId)
    const started = await advanceManualOrderOperatorState(paid.id, "start", { source: "admin" })
    const confirmed = await advanceManualOrderOperatorState(started.id, "confirm", { source: "admin" })
    const completed = await advanceManualOrderOperatorState(confirmed.id, "complete", {
      source: "admin",
      fulfillment: {
        customerPhone: "+2250700000000",
        token: "1234-5678",
        units: "42 kWh"
      }
    })

    expect(completed.metadata?.notifications?.primarySms?.messageSid).toBe("SM_TWILIO_SMS_TEST")
    expect(completed.metadata?.notifications?.primarySms?.retryCount).toBeUndefined()

    const resent = await resendManualOrderSmsDelivery(completed.id)

    expect(resent.metadata?.notifications?.primarySms?.messageSid).toBe("SM_TWILIO_SMS_TEST")
    expect(resent.metadata?.notifications?.primarySms?.retryCount).toBe(1)
    expect(resent.metadata?.notifications?.primarySms?.status).toBe("sent")
  })

  it("prices manually quoted SODECI bills through the profit engine", async () => {
    const created = createManualBillingOrder({
      id: "SODECI-QUOTE-1",
      traceId: "trace-quote-1",
      service: "sodeci",
      countryCode: "CI",
      accountReference: "027009680",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    const quoted = await setManualQuote({
      orderId: created.id,
      quotedAmount: 15000,
      adminQuoteNotes: "Bill looked up"
    })

    const presented = presentManualOrder(quoted)

    expect(quoted.status).toBe("quote_ready")
    expect(quoted.quotedAmount).toBeGreaterThan(15000)
    expect(presented.pricingSummary?.inputAmount).toBe(15000)
    expect(presented.pricingSummary?.customerPrice).toBe(quoted.quotedAmount)
    expect(["arbitrage_margin", "demand_surge"]).toContain(presented.pricingSummary?.pricingStrategy)
  })

  it("records explicit webhook audit events on the order", async () => {
    const created = createManualBillingOrder({
      id: "SODECI-WEBHOOK-1",
      traceId: "trace-webhook-1",
      service: "sodeci",
      countryCode: "CI",
      accountReference: "027009680",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    const updated = await recordManualOrderAuditEvent(created.id, {
      channel: "stripe_webhook",
      event: "checkout.session.completed",
      outcome: "received",
      payload: {
        eventId: "evt_test_1"
      }
    })

    expect(updated).not.toBeNull()
    expect(presentManualOrder(updated!).auditEvents.at(-1)).toMatchObject({
      channel: "stripe_webhook",
      event: "checkout.session.completed",
      outcome: "received"
    })
  })

  it("reuses an existing open SODECI order instead of creating a duplicate", async () => {
    const original = await createManualOrder({
      service: "sodeci",
      accountReference: " 0270-09680 ",
      customerName: "Mimose",
      customerEmail: "MIMOSE@example.com",
      recipientName: "Family Compound"
    })

    const duplicate = await createManualOrder({
      service: "sodeci",
      accountReference: "027009680",
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      recipientName: "Family Compound"
    })

    expect(duplicate.id).toBe(original.id)
    expect(duplicate.metadata?.insights?.resumedExistingOrder).toBe(true)
  })

  it("adds normalized reference and known-account insights for repeat bill references", async () => {
    const created = createManualBillingOrder({
      id: "CIE-KNOWN-1",
      traceId: "trace-known-1",
      service: "cie-postpaid",
      countryCode: "CI",
      accountReference: "CIEP 00-123456",
      currency: "XOF",
      customer: {
        customerName: "Mimose",
        customerEmail: "mimose@example.com",
        recipientName: "Family"
      }
    })

    const quoteReady = transitionManualBillingOrder(created, "quote_ready", {
      quotedAmount: 14250,
      pricingSummary: {
        source: "manual-billing-profit-engine",
        inputAmount: 13500,
        providerCost: 13500,
        customerPrice: 14250,
        afrisendiqMargin: 750,
        afrisendiqMarginPercent: 5.55,
        pricingStrategy: "arbitrage_margin",
        pricingDecision: {
          strategy: "arbitrage_margin",
          customerPrice: 14250,
          providerCost: 13500,
          fxAdjustedCost: 13500,
          fxProfit: 0,
          operatingCost: 0,
          grossMargin: 750,
          grossMarginPercent: 5.55,
          netMarginAfterFees: 750,
          netMarginAfterFeesPercent: 5.55,
          netMarginAfterCosts: 750,
          netMarginAfterCostsPercent: 5.55,
          provider: "manual-billing",
          signals: []
        }
      }
    }, "Previous bill lookup")
    const paymentPending = transitionManualBillingOrder(quoteReady, "payment_pending", { paymentSessionId: "cs_prev_1" }, "Checkout created")
    const paid = transitionManualBillingOrder(paymentPending, "paid", { stripePaymentStatus: "paid" }, "Paid")
    const started = transitionManualBillingOrder(paid, "operator_started", {}, "Operator started")
    const confirmed = transitionManualBillingOrder(started, "operator_confirmed", {}, "Operator confirmed")
    const completed = transitionManualBillingOrder(confirmed, "completed", {}, "Completed")

    const followUp = await createManualOrder({
      service: "cie-postpaid",
      accountReference: "CIEP-00 123456",
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      recipientName: "Family"
    })

    const presented = await getManualOrder(followUp.id)

    expect(presented?.metadata?.normalizedAccountReference).toBe("CIEP00123456")
    expect(presented?.metadata?.insights?.knownAccount).toBe(true)
  })

  it("auto-quotes CIE and SODECI bills when a lookup fixture returns an amount", async () => {
    process.env.MANUAL_BILLING_LOOKUP_FIXTURES = JSON.stringify({
      "027009680": {
        amount: 18500,
        detail: "Fixture lookup matched the current SODECI account."
      }
    })

    const created = await createManualOrder({
      service: "sodeci",
      accountReference: "0270-09680",
      customerName: "Mimose",
      customerEmail: "mimose@example.com",
      recipientName: "Family"
    })

    const presented = presentManualOrder(created)

    expect(created.status).toBe("quote_ready")
    expect(created.metadata?.lookup?.status).toBe("found")
    expect(created.metadata?.lookup?.source).toBe("fixture")
    expect(presented.pricingSummary?.inputAmount).toBe(18500)
    expect(created.quotedAmount).toBeGreaterThan(18500)
  })
})