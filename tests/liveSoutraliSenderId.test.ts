import { processProviderCatalogCheckout } from "@/app/lib/providerCatalogCheckout"

describe("live Soutrali sender id check", () => {
  it("sends a live confirmation through the actual app purchase confirmation path", async () => {
    process.env.TWILIO_ACCOUNT_SID = "twilio-account-sid-test"
    process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token-test"
    process.env.TWILIO_SMS_FROM = "+18334323693"
    delete process.env.TWILIO_SOUTRALI_SMS_SENDER_ID

    const result = await processProviderCatalogCheckout(
      {
        provider: "dtone",
        productId: "dtone-jumia-gift-card",
        customerReference: "+2250596557497",
        recipientLabel: "Recipient",
        amount: 10000,
        senderName: "Kipre",
      },
      {
        createReference: () => "LIVE-SOUTRALI-SENDER-TEST-1",
        createTraceId: () => "trace-live-sender-id-1",
      }
    )

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
  }, 120000)
})