import { buildPurchaseConfirmationMessage, buildPurchaseConfirmationWhatsAppMessage, sendPurchaseConfirmationSms } from "@/app/lib/purchaseConfirmation"

describe("purchase confirmation helper", () => {
  afterEach(() => {
    delete process.env.TWILIO_SOUTRALI_SMS_SENDER_ID
    delete process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID
    delete process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID
  })

  it("builds the requested French Jumia gift-card message", () => {
    const message = buildPurchaseConfirmationMessage({
      reference: "SOUTRALI-1",
      productLabel: "Jumia Gift Card",
      productCategory: "gift-card",
      productBrand: "JUMIA",
      amount: 10000,
      currency: "XOF",
      senderName: "Kipre",
      rechargeCode: "ABCD-1234",
    })

    expect(message).toContain("Soutrali: bon Jumia. De Kipre via AfriSendIQ.")
    expect(message).toContain("Code ABCD-1234")
    expect(message).toContain("jumia.ci")
    expect(message).toContain("afrisendiq.com")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("keeps richer branded WhatsApp French copy", () => {
    const message = buildPurchaseConfirmationWhatsAppMessage({
      reference: "SOUTRALI-WA-1",
      productLabel: "Jumia Gift Card",
      productCategory: "gift-card",
      productBrand: "JUMIA",
      amount: 10000,
      currency: "XOF",
      senderName: "Kipre",
      rechargeCode: "ABCD-1234",
    })

    expect(message).toContain("Vous avez recu un Soutrali de bon d'achat Jumia, par le service Soutrali d'AfriSendIQ, de la part de Kipre.")
    expect(message).toContain("Code : ABCD-1234")
    expect(message).toContain("A utiliser sur www.jumia.ci")
    expect(message).toContain("www.AfriSendIQ.com")
  })

  it("builds the requested airtime top-up phrasing", () => {
    const message = buildPurchaseConfirmationMessage({
      reference: "SOUTRALI-AIRTIME",
      productLabel: "Orange CI Airtime",
      productCategory: "airtime",
      productBrand: "ORANGE",
      amount: 5000,
      currency: "XOF",
      senderName: "Kipre",
    })

    expect(message).toContain("Soutrali: credit Orange CI. De Kipre via AfriSendIQ.")
    expect(message).not.toContain("Airtime")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("builds the requested data top-up phrasing", () => {
    const message = buildPurchaseConfirmationMessage({
      reference: "SOUTRALI-DATA",
      productLabel: "Orange CI 5GB",
      productCategory: "data",
      productBrand: "ORANGE",
      amount: 3000,
      currency: "XOF",
      senderName: "Kipre",
    })

    expect(message).toContain("Soutrali: data Orange CI 5GB. De Kipre via AfriSendIQ.")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("labels CIE prepaid confirmations as code de recharge and formats a 20-digit code", () => {
    const message = buildPurchaseConfirmationMessage({
      reference: "SOUTRALI-2",
      productLabel: "CIE Prepaid",
      productCategory: "electricity",
      productBrand: "CIE",
      amount: 5000,
      currency: "XOF",
      senderName: "Kipre",
      rechargeCode: "12345678901234567890",
    })

    expect(message).toContain("Soutrali: compteur CIE prepaye. De Kipre via AfriSendIQ.")
    expect(message).toContain("Code de recharge 1234 5678 9012 3456 7890")
    expect(message).not.toContain("jumia.ci")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("uses code de recharge in the richer WhatsApp copy for CIE prepaid", () => {
    const message = buildPurchaseConfirmationWhatsAppMessage({
      reference: "SOUTRALI-WA-CIE",
      productLabel: "CIE Prepaid",
      productCategory: "electricity",
      productBrand: "CIE",
      amount: 5000,
      currency: "XOF",
      senderName: "Kipre",
      rechargeCode: "12345678901234567890",
    })

    expect(message).toContain("Vous avez recu un Soutrali de recharge de compteur prepaye, par le service Soutrali d'AfriSendIQ, de la part de Kipre.")
    expect(message).toContain("Code de recharge : 1234 5678 9012 3456 7890")
    expect(message).toContain("www.AfriSendIQ.com")
  })

  it("removes provider names from the customer-facing product label", () => {
    const message = buildPurchaseConfirmationMessage({
      reference: "SOUTRALI-4",
      productLabel: "DT One Jumia Gift Card",
      productCategory: "gift-card",
      productBrand: "JUMIA",
      amount: 10000,
      currency: "XOF",
      senderName: "Kipre",
      rechargeCode: "ABCD-1234",
    })

    expect(message).toContain("Soutrali: bon Jumia. De Kipre via AfriSendIQ.")
    expect(message).not.toContain("DT One")
    expect(message).not.toContain("Ding")
    expect(message).not.toContain("Reloadly")
    expect(message).not.toMatch(/[^\x00-\x7F]/)
  })

  it("sends a WhatsApp template first when a content SID is configured", async () => {
    process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID = "HX_CONFIRM_TEMPLATE"
    process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID = "MG_CONFIRM_SERVICE"

    const sendSms = vi.fn(async () => ({
      sid: "SM_CONFIRM",
      to: "+2250700000000",
      from: "SOUTRALI",
      status: "queued",
    }))
    const sendWhatsApp = vi.fn(async () => ({
      sid: "WA_CONFIRM",
      to: "+2250700000000",
      from: "whatsapp:+18334323693",
      whatsappHref: "https://wa.me/2250700000000",
    }))

    const result = await sendPurchaseConfirmationSms({
      reference: "SOUTRALI-3",
      productLabel: "Orange CI Airtime",
      productCategory: "airtime",
      productBrand: "ORANGE",
      amount: 5000,
      currency: "XOF",
      senderName: "Kipre",
      recipientPhoneCandidates: ["+2250700000000"],
    }, {
      getTwilioConfig: () => ({
        accountSid: "AC123",
        authToken: "secret",
        from: "+18334323693",
      }),
      getSmsStatusCallbackUrl: () => "https://afrisendiq.com/api/twilio/status",
      getWhatsAppStatusCallbackUrl: () => "https://afrisendiq.com/api/twilio/status",
      sendSms,
      sendWhatsApp,
    })

    expect(result).toEqual(expect.objectContaining({
      delivered: true,
      whatsappSid: "WA_CONFIRM",
      to: "+2250700000000",
    }))
    expect(sendSms).not.toHaveBeenCalled()
    expect(sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      contentSid: "HX_CONFIRM_TEMPLATE",
      contentVariables: { "1": expect.stringContaining("Vous avez recu un Soutrali de recharge d'unites Orange CI") },
      messagingServiceSid: "MG_CONFIRM_SERVICE",
      to: "+2250700000000",
    }))
  })

  it("falls back to SMS when the WhatsApp template send fails", async () => {
    process.env.TWILIO_SOUTRALI_SMS_SENDER_ID = "SOUTRALI"
    process.env.TWILIO_WHATSAPP_PURCHASE_CONFIRMATION_CONTENT_SID = "HX_CONFIRM_TEMPLATE"

    const sendSms = vi.fn(async () => ({
      sid: "SM_CONFIRM",
      to: "+2250700000000",
      from: "SOUTRALI",
      status: "queued",
    }))
    const sendWhatsApp = vi.fn(async () => {
      const error = new Error("Failed to send freeform message because you are outside the allowed window") as Error & { code?: number }
      error.code = 63016
      throw error
    })

    const result = await sendPurchaseConfirmationSms({
      reference: "SOUTRALI-4",
      productLabel: "Orange CI Airtime",
      productCategory: "airtime",
      productBrand: "ORANGE",
      amount: 5000,
      currency: "XOF",
      senderName: "Kipre",
      recipientPhoneCandidates: ["+2250700000000"],
    }, {
      getTwilioConfig: () => ({
        accountSid: "AC123",
        authToken: "secret",
        from: "+18334323693",
      }),
      getSmsStatusCallbackUrl: () => "https://afrisendiq.com/api/twilio/status",
      getWhatsAppStatusCallbackUrl: () => "https://afrisendiq.com/api/twilio/status",
      sendSms,
      sendWhatsApp,
    })

    expect(result).toEqual(expect.objectContaining({
      delivered: true,
      sid: "SM_CONFIRM",
      to: "+2250700000000",
    }))
    expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({
      from: "SOUTRALI",
      to: "+2250700000000",
    }))
    expect(sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      contentSid: "HX_CONFIRM_TEMPLATE",
      to: "+2250700000000",
    }))
  })

  it("uses SMS directly when no WhatsApp template content SID is configured", async () => {
    process.env.TWILIO_SOUTRALI_SMS_SENDER_ID = "SOUTRALI"

    const sendSms = vi.fn(async () => ({
      sid: "SM_CONFIRM",
      to: "+2250700000000",
      from: "SOUTRALI",
      status: "queued",
    }))
    const sendWhatsApp = vi.fn()

    const result = await sendPurchaseConfirmationSms({
      reference: "SOUTRALI-5",
      productLabel: "Orange CI Airtime",
      productCategory: "airtime",
      productBrand: "ORANGE",
      amount: 5000,
      currency: "XOF",
      senderName: "Kipre",
      recipientPhoneCandidates: ["+2250700000000"],
    }, {
      getTwilioConfig: () => ({
        accountSid: "AC123",
        authToken: "secret",
        from: "+18334323693",
      }),
      getSmsStatusCallbackUrl: () => "https://afrisendiq.com/api/twilio/status",
      getWhatsAppStatusCallbackUrl: () => "https://afrisendiq.com/api/twilio/status",
      sendSms,
      sendWhatsApp,
    })

    expect(result).toEqual(expect.objectContaining({
      delivered: true,
      sid: "SM_CONFIRM",
      to: "+2250700000000",
    }))
    expect(sendSms).toHaveBeenCalled()
    expect(sendWhatsApp).not.toHaveBeenCalled()
  })
})