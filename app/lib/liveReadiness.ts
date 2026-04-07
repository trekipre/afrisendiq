import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseConfig } from "@/app/lib/supabase"

type CheckStatus = "pass" | "warn" | "fail"

export type ReadinessCheck = {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

export type CieReadinessReport = {
  generatedAt: string
  mode: "live" | "test" | "blocked"
  safeForLiveOrders: boolean
  safeForTestOrders: boolean
  checks: ReadinessCheck[]
  blockers: string[]
}

function isBlank(value?: string | null) {
  return !value || value.trim().length === 0
}

function looksLikePlaceholder(value?: string | null) {
  if (isBlank(value)) {
    return true
  }

  const normalized = String(value).toLowerCase()
  return [
    "your-public-domain",
    "your-project",
    "replace_with",
    "replace_me",
    "example.com",
    "sb_publishable_your",
    "sb_service_role_your",
    "your_secret_key",
    "your_publishable_key",
    "whsec_replace"
  ].some((token) => normalized.includes(token))
}

function isHttpsUrl(value?: string | null) {
  if (isBlank(value) || looksLikePlaceholder(value)) {
    return false
  }

  try {
    const url = new URL(String(value))
    return url.protocol === "https:"
  } catch {
    return false
  }
}

function isAfrisendiqHostname(value?: string | null) {
  if (!isHttpsUrl(value)) {
    return false
  }

  try {
    const url = new URL(String(value))
    return url.hostname === "afrisendiq.com" || url.hostname.endsWith(".afrisendiq.com")
  } catch {
    return false
  }
}

function isTwilioSid(value?: string | null) {
  if (isBlank(value) || looksLikePlaceholder(value)) {
    return false
  }

  return /^AC[0-9a-f]{32}$/i.test(String(value).trim())
}

function isWhatsAppSender(value?: string | null) {
  if (isBlank(value) || looksLikePlaceholder(value)) {
    return false
  }

  return /^whatsapp:\+[1-9]\d{7,14}$/.test(String(value).trim())
}

function isTwilioSandboxSender(value?: string | null) {
  return String(value || "").trim() === "whatsapp:+14155238886"
}

function isTwilioPhoneNumber(value?: string | null) {
  if (isBlank(value) || looksLikePlaceholder(value)) {
    return false
  }

  return /^\+[1-9]\d{7,14}$/.test(String(value).trim())
}

function isOrangeSenderAddress(value?: string | null) {
  if (isBlank(value) || looksLikePlaceholder(value)) {
    return false
  }

  return /^tel:\+\d{4,15}$/.test(String(value).trim())
}

function isMtnSenderAddress(value?: string | null) {
  if (isBlank(value) || looksLikePlaceholder(value)) {
    return false
  }

  return /^[A-Za-z0-9+]{3,32}$/.test(String(value).trim())
}

function isAfricasTalkingSenderId(value?: string | null) {
  if (isBlank(value) || looksLikePlaceholder(value)) {
    return false
  }

  return /^[A-Za-z0-9]{3,11}$/.test(String(value).trim())
}

function getAfricasTalkingDeliveryReportUrl() {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL
  if (!isHttpsUrl(baseUrl)) {
    return undefined
  }

  try {
    return new URL("/api/africastalking/delivery-report", String(baseUrl)).toString()
  } catch {
    return undefined
  }
}

function getAfricasTalkingSmsBulkUrl() {
  return process.env.AFRICAS_TALKING_SMS_BASE_URL || "https://api.africastalking.com/version1/messaging/bulk"
}

function getAfricasTalkingWalletBalanceUrl(username?: string | null) {
  const baseUrl = String(username || "").trim().toLowerCase() === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1/user"
    : "https://api.africastalking.com/version1/user"

  try {
    const url = new URL(baseUrl)
    if (username) {
      url.searchParams.set("username", username)
    }
    return url.toString()
  } catch {
    return undefined
  }
}

async function checkSupabaseTables() {
  const { url, publicKey, serviceRoleKey } = getSupabaseConfig()

  if (isBlank(url) || looksLikePlaceholder(url)) {
    return {
      config: {
        status: "fail" as const,
        detail: "NEXT_PUBLIC_SUPABASE_URL is missing or still using the template value."
      },
      auth: {
        status: "fail" as const,
        detail: "SUPABASE_SERVICE_ROLE_KEY is required for server-side live writes."
      },
      table: {
        status: "fail" as const,
        detail: "Supabase table checks were skipped because the project URL is not usable."
      },
      auditTable: {
        status: "fail" as const,
        detail: "Manual billing audit table checks were skipped because the project URL is not usable."
      },
      webhookTable: {
        status: "fail" as const,
        detail: "Webhook table checks were skipped because the project URL is not usable."
      }
    }
  }

  const key = serviceRoleKey || publicKey
  if (isBlank(key) || looksLikePlaceholder(key)) {
    return {
      config: {
        status: "pass" as const,
        detail: "Supabase URL is configured."
      },
      auth: {
        status: "fail" as const,
        detail: "SUPABASE_SERVICE_ROLE_KEY is missing or still using the template value."
      },
      table: {
        status: "fail" as const,
        detail: "Supabase table checks were skipped because no usable server key is available."
      },
      auditTable: {
        status: "fail" as const,
        detail: "Manual billing audit table checks were skipped because no usable server key is available."
      },
      webhookTable: {
        status: "fail" as const,
        detail: "Webhook table checks were skipped because no usable server key is available."
      }
    }
  }

  const supabase = createClient(String(url), String(key), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  let manualBillingStatus: CheckStatus = "pass"
  let manualBillingDetail = "manual_billing_orders is reachable."

  try {
    const { error } = await supabase.from("manual_billing_orders").select("id").limit(1)
    if (error) {
      manualBillingStatus = "fail"
      manualBillingDetail = `manual_billing_orders check failed: ${error.message}`
    }
  } catch (error) {
    manualBillingStatus = "fail"
    manualBillingDetail = error instanceof Error ? error.message : "manual_billing_orders check failed"
  }

  let webhookStatus: CheckStatus = "pass"
  let webhookDetail = "webhook_events is reachable."

  try {
    const { error } = await supabase.from("webhook_events").select("id").limit(1)
    if (error) {
      webhookStatus = "fail"
      webhookDetail = `webhook_events check failed: ${error.message}`
    }
  } catch (error) {
    webhookStatus = "fail"
    webhookDetail = error instanceof Error ? error.message : "webhook_events check failed"
  }

  let auditStatus: CheckStatus = "pass"
  let auditDetail = "manual_billing_audit_events is reachable."

  try {
    const { error } = await supabase.from("manual_billing_audit_events").select("id").limit(1)
    if (error) {
      auditStatus = "fail"
      auditDetail = `manual_billing_audit_events check failed: ${error.message}`
    }
  } catch (error) {
    auditStatus = "fail"
    auditDetail = error instanceof Error ? error.message : "manual_billing_audit_events check failed"
  }

  return {
    config: {
      status: "pass" as const,
      detail: "Supabase URL is configured."
    },
    auth: {
      status: serviceRoleKey && !looksLikePlaceholder(serviceRoleKey) ? "pass" as const : "warn" as const,
      detail: serviceRoleKey && !looksLikePlaceholder(serviceRoleKey)
        ? "Server-side Supabase writes will use the service role key."
        : "Falling back to the anon key. Test-only setup; not recommended for live orders."
    },
    table: {
      status: manualBillingStatus,
      detail: manualBillingDetail
    },
    auditTable: {
      status: auditStatus,
      detail: auditDetail
    },
    webhookTable: {
      status: webhookStatus,
      detail: webhookDetail
    }
  }
}

async function checkStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const webhookSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CLI_WEBHOOK_SECRET,
    ...String(process.env.STRIPE_WEBHOOK_SECRETS || "")
      .split(",")
      .map((secret) => secret.trim())
      .filter(Boolean)
  ].filter((secret, index, secrets): secret is string => Boolean(secret) && secrets.indexOf(secret) === index)
  const paymentsLiveEnabled = process.env.PAYMENTS_LIVE_ENABLED === "true"
  const productionHostnameDetected = isAfrisendiqHostname(process.env.APP_BASE_URL)
    || isAfrisendiqHostname(process.env.NEXT_PUBLIC_BASE_URL)
    || isAfrisendiqHostname(process.env.NEXT_PUBLIC_SITE_URL)

  const keyMode = secretKey?.startsWith("sk_live_") ? "live" : secretKey?.startsWith("sk_test_") ? "test" : "unknown"
  const publishableMode = publishableKey?.startsWith("pk_live_") ? "live" : publishableKey?.startsWith("pk_test_") ? "test" : "unknown"
  const modesAligned = keyMode === publishableMode && keyMode !== "unknown"
  const liveModeConfigured = keyMode === "live" && publishableMode === "live" && webhookSecrets.length > 0 && paymentsLiveEnabled
  const productionCutoverRequired = productionHostnameDetected
  const productionCutoverReady = !productionCutoverRequired || liveModeConfigured

  let apiStatus: CheckStatus = "fail"
  let apiDetail = "STRIPE_SECRET_KEY is missing or still using the template value."

  if (!isBlank(secretKey) && !looksLikePlaceholder(secretKey)) {
    try {
      const stripe = new Stripe(String(secretKey), { apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion })
      await stripe.accounts.retrieve()
      apiStatus = "pass"
      apiDetail = `Stripe secret key is valid (${keyMode} mode).`
    } catch (error) {
      apiStatus = "fail"
      apiDetail = error instanceof Error ? error.message : "Stripe API validation failed"
    }
  }

  return {
    api: {
      status: apiStatus,
      detail: apiDetail
    },
    publishable: {
      status: !isBlank(publishableKey) && !looksLikePlaceholder(publishableKey) ? "pass" as const : "fail" as const,
      detail: !isBlank(publishableKey) && !looksLikePlaceholder(publishableKey)
        ? `Stripe publishable key is configured (${publishableMode} mode).`
        : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing or still using the template value."
    },
    webhook: {
      status: webhookSecrets.length > 0 ? "pass" as const : "fail" as const,
      detail: webhookSecrets.length > 0
        ? `Stripe webhook signing secret configuration is present (${webhookSecrets.length} secret${webhookSecrets.length === 1 ? "" : "s"}).`
        : "No Stripe webhook signing secrets are configured. Set STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRETS."
    },
    liveToggle: {
      status: paymentsLiveEnabled ? "pass" as const : productionCutoverRequired ? "fail" as const : "warn" as const,
      detail: paymentsLiveEnabled
        ? "PAYMENTS_LIVE_ENABLED is true."
        : productionCutoverRequired
          ? "PAYMENTS_LIVE_ENABLED is false on an afrisendiq.com deployment. Production must be cut over to live Stripe before accepting webhook traffic."
          : "PAYMENTS_LIVE_ENABLED is false. This deployment should not have a live-mode Stripe webhook endpoint enabled until live keys and live webhook secret(s) are configured."
    },
    webhookMode: {
      status: modesAligned && (!productionCutoverRequired || liveModeConfigured) ? "pass" as const : "fail" as const,
      detail: modesAligned && (!productionCutoverRequired || liveModeConfigured)
        ? "Stripe webhook mode is aligned with the current deployment mode."
        : !modesAligned
          ? "Stripe secret and publishable keys are not in the same mode. Keep both keys in test mode or both in live mode before enabling webhook traffic."
          : "Current Stripe configuration is not safe for an afrisendiq.com deployment. Live webhook traffic will fail until live keys, PAYMENTS_LIVE_ENABLED=true, and live webhook secret(s) are configured together."
    },
    productionCutover: {
      status: productionCutoverReady ? "pass" as const : "fail" as const,
      detail: productionCutoverReady
        ? productionCutoverRequired
          ? "Production hostname is using live Stripe configuration."
          : "This hostname is not treated as the production Stripe cutover target."
        : "afrisendiq.com is serving with non-live Stripe configuration. Update Vercel Production to live Stripe keys, enable PAYMENTS_LIVE_ENABLED, and configure the live webhook secret before resending webhook events."
    },
    keyMode,
    publishableMode,
    paymentsLiveEnabled,
    productionCutoverRequired
  }
}

async function checkTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (isBlank(botToken) || looksLikePlaceholder(botToken)) {
    return {
      bot: {
        status: "fail" as const,
        detail: "TELEGRAM_BOT_TOKEN is missing or still using the template value."
      },
      chat: {
        status: "fail" as const,
        detail: "TELEGRAM_CHAT_ID is missing or still using the template value."
      }
    }
  }

  let botStatus: CheckStatus = "pass"
  let botDetail = "Telegram bot token is valid."
  const telegramBotToken = String(botToken)

  try {
    const botResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getMe`)
    const botPayload = await botResponse.json()
    if (!botResponse.ok || !botPayload.ok) {
      botStatus = "fail"
      botDetail = botPayload.description || "Telegram bot validation failed."
    }
  } catch (error) {
    botStatus = "fail"
    botDetail = error instanceof Error ? error.message : "Telegram bot validation failed"
  }

  let chatStatus: CheckStatus = "fail"
  let chatDetail = "TELEGRAM_CHAT_ID is missing or still using the template value."

  if (!isBlank(chatId) && !looksLikePlaceholder(chatId)) {
    try {
      const chatResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getChat?chat_id=${encodeURIComponent(String(chatId))}`)
      const chatPayload = await chatResponse.json()
      if (!chatResponse.ok || !chatPayload.ok) {
        chatDetail = chatPayload.description || "Telegram chat validation failed."
      } else {
        chatStatus = "pass"
        chatDetail = "Telegram operator chat is reachable by the bot."
      }
    } catch (error) {
      chatDetail = error instanceof Error ? error.message : "Telegram chat validation failed"
    }
  }

  return {
    bot: {
      status: botStatus,
      detail: botDetail
    },
    chat: {
      status: chatStatus,
      detail: chatDetail
    }
  }
}

async function checkTwilioWhatsApp() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const sender = process.env.TWILIO_WHATSAPP_FROM

  const accountSidValid = isTwilioSid(accountSid)
  const authTokenValid = !isBlank(authToken) && !looksLikePlaceholder(authToken)
  const senderValid = isWhatsAppSender(sender)

  let senderStatus: CheckStatus = "fail"
  let senderDetail = "TWILIO_WHATSAPP_FROM is missing or not in whatsapp:+225... format."

  if (senderValid) {
    if (isTwilioSandboxSender(sender)) {
      senderStatus = "fail"
      senderDetail = "TWILIO_WHATSAPP_FROM is still the Twilio sandbox sender. Live delivery needs your approved production WhatsApp sender."
    } else {
      senderStatus = "pass"
      senderDetail = "Twilio WhatsApp sender is configured for direct customer delivery."
    }
  }

  let apiStatus: CheckStatus = "fail"
  let apiDetail = "Twilio WhatsApp validation was skipped because the account credentials are incomplete."

  if (accountSidValid && authTokenValid) {
    try {
      const { default: twilio } = await import("twilio")
      const client = twilio(String(accountSid), String(authToken))
      await client.api.accounts(String(accountSid)).fetch()
      apiStatus = "pass"
      apiDetail = "Twilio account credentials are valid."
    } catch (error) {
      apiStatus = "fail"
      apiDetail = error instanceof Error ? error.message : "Twilio account validation failed"
    }
  }

  return {
    accountSid: {
      status: accountSidValid ? "pass" as const : "fail" as const,
      detail: accountSidValid
        ? "TWILIO_ACCOUNT_SID is configured."
        : "TWILIO_ACCOUNT_SID is missing, invalid, or still using the template value."
    },
    authToken: {
      status: authTokenValid ? "pass" as const : "fail" as const,
      detail: authTokenValid
        ? "TWILIO_AUTH_TOKEN is configured."
        : "TWILIO_AUTH_TOKEN is missing or still using the template value."
    },
    sender: {
      status: senderStatus,
      detail: senderDetail
    },
    api: {
      status: apiStatus,
      detail: apiDetail
    }
  }
}

async function checkOrangeSmsFallback() {
  const clientId = process.env.ORANGE_SMS_CLIENT_ID
  const clientSecret = process.env.ORANGE_SMS_CLIENT_SECRET
  const senderAddress = process.env.ORANGE_SMS_SENDER_ADDRESS || "tel:+2250000"

  const clientIdValid = !isBlank(clientId) && !looksLikePlaceholder(clientId)
  const clientSecretValid = !isBlank(clientSecret) && !looksLikePlaceholder(clientSecret)
  const senderValid = isOrangeSenderAddress(senderAddress)

  let apiStatus: CheckStatus = "warn"
  let apiDetail = "Orange SMS fallback is optional and is not configured yet."

  if (clientIdValid && clientSecretValid && senderValid) {
    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
      const tokenResponse = await fetch("https://api.orange.com/oauth/v3/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: "grant_type=client_credentials"
      })

      if (!tokenResponse.ok) {
        apiStatus = "warn"
        apiDetail = `Orange SMS token validation returned ${tokenResponse.status}.`
      } else {
        apiStatus = "pass"
        apiDetail = "Orange SMS credentials are valid for fallback delivery."
      }
    } catch (error) {
      apiStatus = "warn"
      apiDetail = error instanceof Error ? error.message : "Orange SMS validation failed"
    }
  }

  return {
    clientId: {
      status: clientIdValid ? "pass" as const : "warn" as const,
      detail: clientIdValid
        ? "ORANGE_SMS_CLIENT_ID is configured."
        : "ORANGE_SMS_CLIENT_ID is not configured. Orange SMS fallback will stay disabled until it is added."
    },
    clientSecret: {
      status: clientSecretValid ? "pass" as const : "warn" as const,
      detail: clientSecretValid
        ? "ORANGE_SMS_CLIENT_SECRET is configured."
        : "ORANGE_SMS_CLIENT_SECRET is not configured. Orange SMS fallback will stay disabled until it is added."
    },
    senderAddress: {
      status: senderValid ? "pass" as const : "warn" as const,
      detail: senderValid
        ? "Orange sender address is configured."
        : "ORANGE_SMS_SENDER_ADDRESS should use the tel:+2250000 format."
    },
    api: {
      status: apiStatus,
      detail: apiDetail
    }
  }
}

async function checkTwilioSmsFallback() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const soutraliSender = String(process.env.TWILIO_SOUTRALI_SMS_SENDER_ID || "").trim()
  const directSender = String(process.env.TWILIO_SMS_FROM || "").trim()
  const derivedSender = String(process.env.TWILIO_WHATSAPP_FROM || "").replace(/^whatsapp:/, "").trim()
  const sender = /^[A-Za-z0-9]{1,11}$/.test(soutraliSender) ? soutraliSender : directSender || derivedSender

  const accountSidValid = isTwilioSid(accountSid)
  const authTokenValid = !isBlank(authToken) && !looksLikePlaceholder(authToken)
  const senderValid = isTwilioPhoneNumber(sender) || /^[A-Za-z0-9]{1,11}$/.test(String(sender || ""))

  let apiStatus: CheckStatus = "warn"
  let apiDetail = "Twilio SMS fallback is optional and is not configured yet."

  if (accountSidValid && authTokenValid && senderValid) {
    try {
      const { default: twilio } = await import("twilio")
      const client = twilio(String(accountSid), String(authToken))
      await client.api.accounts(String(accountSid)).fetch()
      apiStatus = "pass"
      apiDetail = "Twilio SMS sender can be used for primary fallback delivery."
    } catch (error) {
      apiStatus = "warn"
      apiDetail = error instanceof Error ? error.message : "Twilio SMS validation failed"
    }
  }

  return {
    sender: {
      status: senderValid ? "pass" as const : "warn" as const,
      detail: senderValid
        ? (/^[A-Za-z0-9]{1,11}$/.test(String(sender || ""))
          ? "Twilio SMS sender is configured with a branded alphanumeric sender ID."
          : "Twilio SMS sender is configured with a numeric sender. Add TWILIO_SOUTRALI_SMS_SENDER_ID if you want branded Soutrali delivery.")
        : "TWILIO_SOUTRALI_SMS_SENDER_ID and TWILIO_SMS_FROM are not configured. The app will derive the SMS sender from TWILIO_WHATSAPP_FROM when possible."
    },
    api: {
      status: apiStatus,
      detail: apiDetail
    }
  }
}

async function checkMtnSmsFallback() {
  const consumerKey = process.env.MTN_SMS_CONSUMER_KEY
  const consumerSecret = process.env.MTN_SMS_CONSUMER_SECRET
  const senderAddress = process.env.MTN_SMS_SENDER_ADDRESS
  const notifyUrl = process.env.MTN_SMS_NOTIFY_URL

  const consumerKeyValid = !isBlank(consumerKey) && !looksLikePlaceholder(consumerKey)
  const consumerSecretValid = !isBlank(consumerSecret) && !looksLikePlaceholder(consumerSecret)
  const senderValid = isMtnSenderAddress(senderAddress)
  const notifyUrlValid = isHttpsUrl(notifyUrl)

  let apiStatus: CheckStatus = "warn"
  let apiDetail = "MTN SMS V2 fallback is optional and is not configured yet."

  if (consumerKeyValid && consumerSecretValid) {
    try {
      const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")
      const tokenResponse = await fetch("https://api.mtn.com/v1/oauth/access_token/accesstoken?grant_type=client_credentials", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json"
        },
      })

      if (!tokenResponse.ok) {
        apiStatus = "warn"
        apiDetail = `MTN SMS V2 token validation returned ${tokenResponse.status}.`
      } else {
        apiStatus = "pass"
        apiDetail = "MTN SMS V2 credentials are valid for backup delivery."
      }
    } catch (error) {
      apiStatus = "warn"
      apiDetail = error instanceof Error ? error.message : "MTN SMS validation failed"
    }
  }

  return {
    consumerKey: {
      status: consumerKeyValid ? "pass" as const : "warn" as const,
      detail: consumerKeyValid
        ? "MTN_SMS_CONSUMER_KEY is configured."
        : "MTN_SMS_CONSUMER_KEY is not configured. MTN backup fallback will stay disabled until it is added."
    },
    consumerSecret: {
      status: consumerSecretValid ? "pass" as const : "warn" as const,
      detail: consumerSecretValid
        ? "MTN_SMS_CONSUMER_SECRET is configured."
        : "MTN_SMS_CONSUMER_SECRET is not configured. MTN backup fallback will stay disabled until it is added."
    },
    senderAddress: {
      status: senderValid ? "pass" as const : "warn" as const,
      detail: senderValid
        ? "MTN SMS sender address is configured."
        : "MTN_SMS_SENDER_ADDRESS is not configured. Use the MTN short code or virtual MSISDN assigned to Soutrali."
    },
    notifyUrl: {
      status: notifyUrlValid ? "pass" as const : "warn" as const,
      detail: notifyUrlValid
        ? "MTN delivery notification URL is configured."
        : "MTN_SMS_NOTIFY_URL is not configured. Delivery receipt subscription cannot be created until a public HTTPS callback URL is set."
    },
    api: {
      status: apiStatus,
      detail: apiDetail
    }
  }
}

async function checkAfricasTalking() {
  const username = process.env.AFRICAS_TALKING_USERNAME
  const apiKey = process.env.AFRICAS_TALKING_API_KEY
  const senderId = process.env.AFRICAS_TALKING_SENDER_ID
  const callbackUrl = getAfricasTalkingDeliveryReportUrl()

  const usernameValid = !isBlank(username) && !looksLikePlaceholder(username)
  const apiKeyValid = !isBlank(apiKey) && !looksLikePlaceholder(apiKey)
  const senderIdValid = isAfricasTalkingSenderId(senderId)
  const callbackUrlValid = Boolean(callbackUrl)
  const smsBulkUrl = getAfricasTalkingSmsBulkUrl()
  const sandboxUsername = String(username || "").trim().toLowerCase() === "sandbox"
  const liveBulkUrl = !smsBulkUrl.toLowerCase().includes("sandbox")

  let apiStatus: CheckStatus = "warn"
  let apiDetail = "Africa's Talking credential validation is waiting for the required username and API key."

  if (usernameValid && apiKeyValid) {
    const validationUrl = getAfricasTalkingWalletBalanceUrl(username)

    if (!validationUrl) {
      apiDetail = "Africa's Talking wallet balance validation URL could not be constructed."
    } else {
      try {
        const response = await fetch(validationUrl, {
          method: "GET",
          headers: {
            apiKey: String(apiKey),
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
          }
        })

        const rawBody = typeof response.text === "function"
          ? await response.text()
          : JSON.stringify(await response.json().catch(() => ({})))
        const payload = (() => {
          try {
            return JSON.parse(rawBody) as {
              status?: string
              balance?: string
              userData?: {
                balance?: string
              }
              UserData?: {
                balance?: string
              }
              errorMessage?: string
            }
          } catch {
            return {}
          }
        })()

        const responseMessage = payload.errorMessage || rawBody.trim()
        const balance = payload.userData?.balance || payload.UserData?.balance || payload.balance

        if (response.ok && balance) {
          apiStatus = "pass"
          apiDetail = balance
            ? `Africa's Talking credentials are valid. Wallet balance response: ${balance}.`
            : "Africa's Talking credentials are valid."
        } else if (response.ok && payload.status === "Success") {
          apiStatus = "pass"
          apiDetail = payload.balance
            ? `Africa's Talking credentials are valid. Wallet balance response: ${payload.balance}.`
            : "Africa's Talking credentials are valid."
        } else {
          apiDetail = responseMessage
            || (payload.status ? `Africa's Talking wallet balance endpoint returned ${payload.status}.` : `Africa's Talking credential validation returned ${response.status}.`)
        }
      } catch (error) {
        apiDetail = error instanceof Error ? error.message : "Africa's Talking credential validation failed"
      }
    }
  }

  let smsApiStatus: CheckStatus = "warn"
  let smsApiDetail = "Africa's Talking SMS endpoint validation is waiting for the required username, API key, and sender ID."

  if (usernameValid && apiKeyValid && senderIdValid) {
    if (sandboxUsername && liveBulkUrl) {
      smsApiDetail = "AFRICAS_TALKING_USERNAME is still set to sandbox, but bulk SMS is using the live endpoint. Create and use a live application username for SMS."
    } else {
      try {
        const response = await fetch(smsBulkUrl, {
          method: "POST",
          headers: {
            apiKey: String(apiKey),
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username,
            message: "AfriSendIQ readiness probe",
            senderId,
            phoneNumbers: ["+123"],
            enqueue: true,
          }),
        })

        const rawBody = typeof response.text === "function"
          ? await response.text()
          : JSON.stringify(await response.json().catch(() => ({})))
        const payload = (() => {
          try {
            return JSON.parse(rawBody) as {
              errorMessage?: string
              SMSMessageData?: {
                Message?: string
                Recipients?: Array<{
                  statusCode?: number
                  status?: string
                  number?: string
                }>
              }
            }
          } catch {
            return {}
          }
        })()

        const responseMessage = payload.errorMessage || payload.SMSMessageData?.Message || rawBody.trim()

        const recipient = payload.SMSMessageData?.Recipients?.[0]

        if (response.status === 401) {
          smsApiDetail = responseMessage || "Africa's Talking SMS endpoint rejected the supplied authentication."
        } else if (recipient?.statusCode === 402) {
          smsApiDetail = recipient.status || responseMessage || "Africa's Talking SMS endpoint rejected the configured sender ID."
        } else if (recipient?.statusCode === 403 || recipient?.statusCode === 404) {
          smsApiStatus = "pass"
          smsApiDetail = recipient.status || responseMessage || "Africa's Talking SMS endpoint accepted authentication and rejected the deliberate invalid probe number."
        } else if (response.ok && recipient?.number) {
          smsApiStatus = "pass"
          smsApiDetail = recipient.status || responseMessage || "Africa's Talking SMS endpoint accepted the readiness probe request."
        } else {
          smsApiDetail = responseMessage || `Africa's Talking SMS endpoint validation returned ${response.status}.`
        }
      } catch (error) {
        smsApiDetail = error instanceof Error ? error.message : "Africa's Talking SMS endpoint validation failed"
      }
    }
  }

  const readyToAttempt = usernameValid && apiKeyValid && senderIdValid && callbackUrlValid && apiStatus === "pass" && smsApiStatus === "pass"

  return {
    username: {
      status: usernameValid ? "pass" as const : "warn" as const,
      detail: usernameValid
        ? "AFRICAS_TALKING_USERNAME is configured."
        : "AFRICAS_TALKING_USERNAME is not configured. Africa's Talking cannot be used for the first verification-triggering API call until it is added."
    },
    apiKey: {
      status: apiKeyValid ? "pass" as const : "warn" as const,
      detail: apiKeyValid
        ? "AFRICAS_TALKING_API_KEY is configured."
        : "AFRICAS_TALKING_API_KEY is not configured. Africa's Talking cannot be used for the first verification-triggering API call until it is added."
    },
    senderId: {
      status: senderIdValid ? "pass" as const : "warn" as const,
      detail: senderIdValid
        ? "AFRICAS_TALKING_SENDER_ID is configured."
        : "AFRICAS_TALKING_SENDER_ID is missing, invalid, or still using a template value. Use the approved alphanumeric sender ID or shortcode assigned in Africa's Talking."
    },
    callbackUrl: {
      status: callbackUrlValid ? "pass" as const : "warn" as const,
      detail: callbackUrlValid
        ? `Africa's Talking delivery report callback target is ${callbackUrl}. Configure the same URL in the Africa's Talking dashboard.`
        : "Africa's Talking delivery report callback target could not be derived because APP_BASE_URL or NEXT_PUBLIC_BASE_URL is not a public HTTPS URL."
    },
    api: {
      status: apiStatus,
      detail: apiDetail
    },
    smsApi: {
      status: smsApiStatus,
      detail: smsApiDetail
    },
    readiness: {
      status: readyToAttempt ? "pass" as const : "warn" as const,
      detail: readyToAttempt
        ? "Africa's Talking appears ready for the first verification-triggering SMS API call."
        : "Africa's Talking is not fully ready yet. Confirm the wallet/auth probe, SMS endpoint probe, and dashboard callback before attempting the first verification-triggering SMS API call."
    }
  }
}

function buildUrlChecks() {
  const appBaseUrl = process.env.APP_BASE_URL
  const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  return {
    appBaseUrl: {
      status: isHttpsUrl(appBaseUrl) ? "pass" as const : "fail" as const,
      detail: isHttpsUrl(appBaseUrl)
        ? "APP_BASE_URL is a public HTTPS URL."
        : "APP_BASE_URL must be a real HTTPS URL for Stripe webhooks and redirect targets."
    },
    publicBaseUrl: {
      status: isHttpsUrl(publicBaseUrl) ? "pass" as const : "fail" as const,
      detail: isHttpsUrl(publicBaseUrl)
        ? "NEXT_PUBLIC_BASE_URL is a public HTTPS URL."
        : "NEXT_PUBLIC_BASE_URL must be a real HTTPS URL for live customer redirects."
    },
    siteUrl: {
      status: isHttpsUrl(siteUrl) ? "pass" as const : "warn" as const,
      detail: isHttpsUrl(siteUrl)
        ? "NEXT_PUBLIC_SITE_URL is configured."
        : "NEXT_PUBLIC_SITE_URL is missing or not public HTTPS. SEO metadata will be inaccurate."
    }
  }
}

export async function getCieReadinessReport(): Promise<CieReadinessReport> {
  const supabaseChecks = await checkSupabaseTables()
  const stripeChecks = await checkStripe()
  const telegramChecks = await checkTelegram()
  const twilioWhatsAppChecks = await checkTwilioWhatsApp()
  const twilioSmsChecks = await checkTwilioSmsFallback()
  const orangeSmsChecks = await checkOrangeSmsFallback()
  const mtnSmsChecks = await checkMtnSmsFallback()
  const africasTalkingChecks = await checkAfricasTalking()
  const urlChecks = buildUrlChecks()

  const checks: ReadinessCheck[] = [
    { id: "app-base-url", label: "App base URL", ...urlChecks.appBaseUrl },
    { id: "public-base-url", label: "Public base URL", ...urlChecks.publicBaseUrl },
    { id: "site-url", label: "Site URL", ...urlChecks.siteUrl },
    { id: "supabase-url", label: "Supabase URL", ...supabaseChecks.config },
    { id: "supabase-auth", label: "Supabase server auth", ...supabaseChecks.auth },
    { id: "manual-billing-table", label: "manual_billing_orders table", ...supabaseChecks.table },
    { id: "manual-billing-audit-table", label: "manual_billing_audit_events table", ...supabaseChecks.auditTable },
    { id: "webhook-events-table", label: "webhook_events table", ...supabaseChecks.webhookTable },
    { id: "stripe-api", label: "Stripe secret key", ...stripeChecks.api },
    { id: "stripe-publishable", label: "Stripe publishable key", ...stripeChecks.publishable },
    { id: "stripe-webhook", label: "Stripe webhook secret", ...stripeChecks.webhook },
    { id: "stripe-live-toggle", label: "Payments live toggle", ...stripeChecks.liveToggle },
    { id: "stripe-webhook-mode", label: "Stripe webhook mode alignment", ...stripeChecks.webhookMode },
    { id: "stripe-production-cutover", label: "Stripe production cutover", ...stripeChecks.productionCutover },
    { id: "telegram-bot", label: "Telegram bot", ...telegramChecks.bot },
    { id: "telegram-chat", label: "Telegram operator chat", ...telegramChecks.chat },
    { id: "twilio-whatsapp-account", label: "Twilio account SID", ...twilioWhatsAppChecks.accountSid },
    { id: "twilio-whatsapp-auth", label: "Twilio auth token", ...twilioWhatsAppChecks.authToken },
    { id: "twilio-whatsapp-sender", label: "Twilio WhatsApp sender", ...twilioWhatsAppChecks.sender },
    { id: "twilio-whatsapp-api", label: "Twilio WhatsApp API validation", ...twilioWhatsAppChecks.api },
    { id: "twilio-sms-sender", label: "Twilio SMS sender", ...twilioSmsChecks.sender },
    { id: "twilio-sms-api", label: "Twilio SMS API validation", ...twilioSmsChecks.api },
    { id: "orange-sms-client-id", label: "Orange SMS client ID", ...orangeSmsChecks.clientId },
    { id: "orange-sms-client-secret", label: "Orange SMS client secret", ...orangeSmsChecks.clientSecret },
    { id: "orange-sms-sender-address", label: "Orange SMS sender address", ...orangeSmsChecks.senderAddress },
    { id: "orange-sms-api", label: "Orange SMS API validation", ...orangeSmsChecks.api },
    { id: "mtn-sms-consumer-key", label: "MTN SMS consumer key", ...mtnSmsChecks.consumerKey },
    { id: "mtn-sms-consumer-secret", label: "MTN SMS consumer secret", ...mtnSmsChecks.consumerSecret },
    { id: "mtn-sms-sender-address", label: "MTN SMS sender address", ...mtnSmsChecks.senderAddress },
    { id: "mtn-sms-notify-url", label: "MTN SMS notify URL", ...mtnSmsChecks.notifyUrl },
    { id: "mtn-sms-api", label: "MTN SMS API validation", ...mtnSmsChecks.api },
    { id: "africas-talking-username", label: "Africa's Talking username", ...africasTalkingChecks.username },
    { id: "africas-talking-api-key", label: "Africa's Talking API key", ...africasTalkingChecks.apiKey },
    { id: "africas-talking-sender-id", label: "Africa's Talking sender ID", ...africasTalkingChecks.senderId },
    { id: "africas-talking-callback-url", label: "Africa's Talking delivery report callback", ...africasTalkingChecks.callbackUrl },
    { id: "africas-talking-api", label: "Africa's Talking wallet auth validation", ...africasTalkingChecks.api },
    { id: "africas-talking-sms-api", label: "Africa's Talking SMS API validation", ...africasTalkingChecks.smsApi },
    { id: "africas-talking-readiness", label: "Africa's Talking verification readiness", ...africasTalkingChecks.readiness }
  ]

  const blockers = checks
    .filter((check) => check.status === "fail")
    .map((check) => `${check.label}: ${check.detail}`)

  const safeForTestOrders = blockers.length === 0 && stripeChecks.keyMode === "test" && stripeChecks.publishableMode === "test"
  const safeForLiveOrders = blockers.length === 0
    && stripeChecks.keyMode === "live"
    && stripeChecks.publishableMode === "live"
    && stripeChecks.paymentsLiveEnabled
    && urlChecks.appBaseUrl.status === "pass"
    && urlChecks.publicBaseUrl.status === "pass"
    && supabaseChecks.auth.status === "pass"
    && twilioWhatsAppChecks.sender.status === "pass"
    && twilioWhatsAppChecks.api.status === "pass"

  return {
    generatedAt: new Date().toISOString(),
    mode: safeForLiveOrders ? "live" : safeForTestOrders ? "test" : "blocked",
    safeForLiveOrders,
    safeForTestOrders,
    checks,
    blockers
  }
}