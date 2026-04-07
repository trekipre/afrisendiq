import { getCieReadinessReport } from "@/app/lib/liveReadiness"

vi.mock("@/app/lib/supabase", () => ({
  getSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    publicKey: "sb_publishable_live_valid",
    serviceRoleKey: "sb_service_role_live_valid"
  })
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        limit: async () => ({ error: null })
      })
    })
  })
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    accounts = {
      retrieve: vi.fn(async () => ({ id: "acct_live_123" }))
    }
  }
}))

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    api: {
      accounts: () => ({
        fetch: vi.fn(async () => ({ sid: `AC${"1".repeat(32)}` }))
      })
    }
  }))
}))

describe("CIE live readiness", () => {
  const originalEnv = { ...process.env }
  const liveSecretKey = ["sk", "live", "valid"].join("_")
  const livePublishableKey = ["pk", "live", "valid"].join("_")
  const liveWebhookSecret = ["whsec", "live", "valid"].join("_")
  const twilioAccountSid = `AC${"1".repeat(32)}`

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_BASE_URL: "https://ops.afrisendiq.com",
      NEXT_PUBLIC_BASE_URL: "https://afrisendiq.com",
      NEXT_PUBLIC_SITE_URL: "https://afrisendiq.com",
      STRIPE_SECRET_KEY: liveSecretKey,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: livePublishableKey,
      STRIPE_WEBHOOK_SECRET: liveWebhookSecret,
      PAYMENTS_LIVE_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: "telegram_bot_token_valid",
      TELEGRAM_CHAT_ID: "123456789",
      TWILIO_ACCOUNT_SID: twilioAccountSid,
      TWILIO_AUTH_TOKEN: "twilio_auth_token_valid",
      TWILIO_WHATSAPP_FROM: "whatsapp:+2250700000000",
      TWILIO_SMS_FROM: "+18334323693"
    }

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input)

      if (url.includes("getMe")) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { id: 1 } })
        }
      }

      if (url.includes("getChat")) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { id: 123456789 } })
        }
      }

      if (url.includes("api.sandbox.africastalking.com/version1/user")) {
        return {
          ok: true,
          json: async () => ({ UserData: { balance: "KES 10.00" } })
        }
      }

      if (url.includes("api.africastalking.com/version1/messaging/bulk")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            SMSMessageData: {
              Message: "Sent to 0/1 Total Cost: KES 0.0000",
              Recipients: [{ statusCode: 403, status: "InvalidPhoneNumber", number: "+123" }]
            }
          })
        }
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    }))
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it("marks live readiness safe when Twilio WhatsApp delivery is fully configured", async () => {
    const report = await getCieReadinessReport()

    expect(report.safeForLiveOrders).toBe(true)
    expect(report.mode).toBe("live")
    expect(report.checks.find((check) => check.id === "stripe-production-cutover")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "twilio-whatsapp-api")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "twilio-whatsapp-sender")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "twilio-sms-sender")?.status).toBe("pass")
  })

  it("accepts a branded Twilio SMS sender id for readiness", async () => {
    delete process.env.TWILIO_SMS_FROM
    process.env.TWILIO_SOUTRALI_SMS_SENDER_ID = "SOUTRALI"

    const report = await getCieReadinessReport()

    expect(report.checks.find((check) => check.id === "twilio-sms-sender")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "twilio-sms-sender")?.detail).toContain("branded alphanumeric sender ID")
  })

  it("fails loudly when an afrisendiq.com deployment is still on Stripe test mode", async () => {
    const testSecretKey = ["sk", "test", "production", "mismatch"].join("_")
    const testPublishableKey = ["pk", "test", "production", "mismatch"].join("_")
    const testWebhookSecret = ["whsec", "test", "production", "mismatch"].join("_")

    process.env.APP_BASE_URL = "https://www.afrisendiq.com"
    process.env.NEXT_PUBLIC_BASE_URL = "https://www.afrisendiq.com"
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.afrisendiq.com"
    process.env.STRIPE_SECRET_KEY = testSecretKey
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = testPublishableKey
    process.env.STRIPE_WEBHOOK_SECRET = testWebhookSecret
    process.env.PAYMENTS_LIVE_ENABLED = "false"

    const report = await getCieReadinessReport()

    expect(report.safeForLiveOrders).toBe(false)
    expect(report.safeForTestOrders).toBe(false)
    expect(report.mode).toBe("blocked")
    expect(report.checks.find((check) => check.id === "stripe-live-toggle")?.status).toBe("fail")
    expect(report.checks.find((check) => check.id === "stripe-webhook-mode")?.status).toBe("fail")
    expect(report.checks.find((check) => check.id === "stripe-production-cutover")?.status).toBe("fail")
  })

  it("keeps non-production Stripe test mode usable for test orders", async () => {
    const previewSecretKey = ["sk", "test", "preview", "valid"].join("_")
    const previewPublishableKey = ["pk", "test", "preview", "valid"].join("_")
    const previewWebhookSecret = ["whsec", "test", "preview", "valid"].join("_")

    process.env.APP_BASE_URL = "https://preview.afrisendiq-preview.net"
    process.env.NEXT_PUBLIC_BASE_URL = "https://preview.afrisendiq-preview.net"
    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.afrisendiq-preview.net"
    process.env.STRIPE_SECRET_KEY = previewSecretKey
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = previewPublishableKey
    process.env.STRIPE_WEBHOOK_SECRET = previewWebhookSecret
    process.env.PAYMENTS_LIVE_ENABLED = "false"

    const report = await getCieReadinessReport()

    expect(report.safeForTestOrders).toBe(true)
    expect(report.mode).toBe("test")
    expect(report.checks.find((check) => check.id === "stripe-live-toggle")?.status).toBe("warn")
    expect(report.checks.find((check) => check.id === "stripe-webhook-mode")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "stripe-production-cutover")?.status).toBe("pass")
  })

  it("blocks live readiness when WhatsApp delivery is still pointed at the Twilio sandbox sender", async () => {
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886"

    const report = await getCieReadinessReport()

    expect(report.safeForLiveOrders).toBe(false)
    expect(report.mode).toBe("blocked")
    expect(report.checks.find((check) => check.id === "twilio-whatsapp-sender")?.status).toBe("fail")
  })

  it("surfaces Africa's Talking setup as a warning when credentials are missing", async () => {
    delete process.env.AFRICAS_TALKING_USERNAME
    delete process.env.AFRICAS_TALKING_API_KEY
    delete process.env.AFRICAS_TALKING_SENDER_ID

    const report = await getCieReadinessReport()

    expect(report.checks.find((check) => check.id === "africas-talking-username")?.status).toBe("warn")
    expect(report.checks.find((check) => check.id === "africas-talking-api-key")?.status).toBe("warn")
    expect(report.checks.find((check) => check.id === "africas-talking-sender-id")?.status).toBe("warn")
    expect(report.checks.find((check) => check.id === "africas-talking-readiness")?.status).toBe("warn")
  })

  it("marks Africa's Talking ready for the first verification call when credentials are present", async () => {
    process.env.AFRICAS_TALKING_USERNAME = "afrisendiq"
    process.env.AFRICAS_TALKING_API_KEY = "africas_talking_api_key_valid"
    process.env.AFRICAS_TALKING_SENDER_ID = "AFRISENDIQ"

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input)

      if (url.includes("getMe")) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { id: 1 } })
        }
      }

      if (url.includes("getChat")) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { id: 123456789 } })
        }
      }

      if (url.includes("api.africastalking.com/version1/user")) {
        return {
          ok: true,
          json: async () => ({ UserData: { balance: "USD 10.00" } })
        }
      }

      if (url.includes("api.africastalking.com/version1/messaging/bulk")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            SMSMessageData: {
              Message: "Sent to 0/1 Total Cost: USD 0.0000",
              Recipients: [{ statusCode: 403, status: "InvalidPhoneNumber", number: "+123" }]
            }
          })
        }
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    }))

    const report = await getCieReadinessReport()

    expect(report.checks.find((check) => check.id === "africas-talking-username")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "africas-talking-api-key")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "africas-talking-sender-id")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "africas-talking-callback-url")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "africas-talking-api")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "africas-talking-sms-api")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "africas-talking-readiness")?.status).toBe("pass")
  })

  it("keeps Africa's Talking in warning state when credential validation fails", async () => {
    process.env.AFRICAS_TALKING_USERNAME = "afrisendiq"
    process.env.AFRICAS_TALKING_API_KEY = "africas_talking_api_key_invalid"
    process.env.AFRICAS_TALKING_SENDER_ID = "AFRISENDIQ"

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input)

      if (url.includes("getMe")) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { id: 1 } })
        }
      }

      if (url.includes("getChat")) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { id: 123456789 } })
        }
      }

      if (url.includes("api.sandbox.africastalking.com/version1/user") || url.includes("api.africastalking.com/version1/user")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ status: "Failed", errorMessage: "The supplied authentication is invalid" })
        }
      }

      if (url.includes("api.africastalking.com/version1/messaging/bulk")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ errorMessage: "The supplied authentication is invalid" })
        }
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    }))

    const report = await getCieReadinessReport()

    expect(report.checks.find((check) => check.id === "africas-talking-api")?.status).toBe("warn")
    expect(report.checks.find((check) => check.id === "africas-talking-sms-api")?.status).toBe("warn")
    expect(report.checks.find((check) => check.id === "africas-talking-readiness")?.status).toBe("warn")
  })

  it("surfaces the sandbox username mismatch separately for SMS validation", async () => {
    process.env.AFRICAS_TALKING_USERNAME = "sandbox"
    process.env.AFRICAS_TALKING_API_KEY = "africas_talking_api_key_valid"
    process.env.AFRICAS_TALKING_SENDER_ID = "AFRISENDIQ"

    const report = await getCieReadinessReport()

    expect(report.checks.find((check) => check.id === "africas-talking-api")?.status).toBe("pass")
    expect(report.checks.find((check) => check.id === "africas-talking-sms-api")?.status).toBe("warn")
    expect(report.checks.find((check) => check.id === "africas-talking-sms-api")?.detail).toContain("sandbox")
  })
})